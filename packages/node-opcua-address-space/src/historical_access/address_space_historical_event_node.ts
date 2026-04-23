/**
 * @module node-opcua-address-space
 *
 * Historical Access for Events — server-side plumbing.
 *
 * Mirrors address_space_historical_data_node.ts but for UAObject / notifier
 * nodes answering HistoryRead(ReadEventDetails) instead of HistoryRead(ReadRawModifiedDetails).
 *
 * Three layers:
 *   1. IEventHistorian (interface)    — see i_event_historian.ts
 *   2. EventHistorian (default impl)  — ring-buffer in-memory historian
 *   3. AddressSpace_installHistoricalEventNode — wires it into the address space:
 *        - Attaches `_historyRead` onto the UAObject so the server-side dispatcher
 *          in addressSpace_accessor.ts can route to us.
 *        - Subscribes to `node.on("event", ...)` so every raiseEvent flowing
 *          through this notifier is automatically pushed into the historian.
 *        - Flips EventNotifier.HistoryRead so clients know the node is history-capable.
 *        - Tracks the node on AddressSpace.historizingEventNodes for bulk ops.
 */

import { assert } from "node-opcua-assert";
import { QualifiedNameLike } from "node-opcua-data-model";
import { NumericRange } from "node-opcua-numeric-range";
import {
    HistoryReadDetails,
    HistoryReadResult,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-service-history";
import { HistoryEvent, HistoryEventFieldList } from "node-opcua-types";
import { StatusCodes } from "node-opcua-status-code";
import { CallbackT } from "node-opcua-status-code";
import { extractEventFieldsBase, FilterContextOnAddressSpace } from "node-opcua-service-filter";
import {
    ContinuationData,
    EventNotifierFlags,
    IAddressSpace,
    IEventData,
    IEventHistorian,
    IEventHistorianOptions,
    ISessionContext,
    UAObject
} from "node-opcua-address-space-base";

import { AddressSpace } from "../../source/address_space_ts";
import { SessionContext } from "../../source/session_context";

// ---------------------------------------------------------------------------
// Default In-Memory Historian
//
// Ring-buffer; stores raw IEventData snapshots. On extract, projects each
// snapshot through the client's SimpleAttributeOperand[] (selectClauses)
// using the shared extractEventFieldsBase helper.
//
// Applications that want persistent storage should supply their own
// IEventHistorian to installHistoricalEventNode({ historian }).
// ---------------------------------------------------------------------------

interface CapturedEvent {
    capturedAt: Date;
    eventData: IEventData;
}

const DEFAULT_MAX_ONLINE_EVENTS = 1000;

export class EventHistorian implements IEventHistorian {
    private readonly ring: CapturedEvent[] = [];
    private readonly capacity: number;

    constructor(options: IEventHistorianOptions = {}) {
        this.capacity = options.maxOnlineEvents ?? DEFAULT_MAX_ONLINE_EVENTS;
    }

    public async push(newEventData: IEventData): Promise<void> {
        this.ring.push({ capturedAt: new Date(), eventData: newEventData });
        // Bounded ring — drop oldest when over capacity
        while (this.ring.length > this.capacity) {
            this.ring.shift();
        }
    }

    public extractEvents(
        historyReadEventDetails: ReadEventDetails,
        maxNumberToExtract: number,
        isReversed: boolean,
        _reverseEventData: boolean,
        callback: (err: Error | null, eventData?: HistoryEventFieldList[]) => void
    ): void {
        const startTime = historyReadEventDetails.startTime
            ? new Date(historyReadEventDetails.startTime).getTime()
            : -Infinity;
        const endTime = historyReadEventDetails.endTime
            ? new Date(historyReadEventDetails.endTime).getTime()
            : Infinity;

        // Filter by time window
        let windowed = this.ring.filter((c) => {
            const t = c.capturedAt.getTime();
            return t >= startTime && t <= endTime;
        });

        if (isReversed) {
            windowed = windowed.slice().reverse();
        }

        if (maxNumberToExtract > 0 && windowed.length > maxNumberToExtract) {
            windowed = windowed.slice(0, maxNumberToExtract);
        }

        // Project each IEventData through selectClauses → HistoryEventFieldList.
        // The filter context wants a SessionContext; we use the default because
        // historyRead's incoming context is typically the Server's system session
        // and the projection is user-agnostic.
        const systemContext = SessionContext.defaultContext as ISessionContext;
        const selectClauses = historyReadEventDetails.filter?.selectClauses ?? [];

        const events: HistoryEventFieldList[] = windowed.map((c) => {
            const ctx = new FilterContextOnAddressSpace(systemContext, c.eventData);
            const eventFields = extractEventFieldsBase(ctx, selectClauses);
            return new HistoryEventFieldList({ eventFields });
        });

        callback(null, events);
    }
}

// ---------------------------------------------------------------------------
// HistoryRead dispatcher for UAObject notifier nodes
// ---------------------------------------------------------------------------

function _historyReadForEvents(
    this: UAObject,
    _context: ISessionContext,
    historyReadDetails: HistoryReadDetails | ReadRawModifiedDetails | ReadEventDetails | ReadProcessedDetails | ReadAtTimeDetails,
    _indexRange: NumericRange | null,
    _dataEncoding: QualifiedNameLike | null,
    _continuationData: ContinuationData,
    callback: CallbackT<HistoryReadResult>
): void {
    const historian: IEventHistorian | undefined = (this as any).$eventHistorian;

    if (!(historyReadDetails instanceof ReadEventDetails)) {
        // Non-event requests on a notifier node — by spec, objects don't carry value history.
        return callback(
            null,
            new HistoryReadResult({ statusCode: StatusCodes.BadHistoryOperationUnsupported })
        );
    }

    if (!historian) {
        return callback(
            null,
            new HistoryReadResult({ statusCode: StatusCodes.BadHistoryOperationUnsupported })
        );
    }

    const maxNumberToExtract = historyReadDetails.numValuesPerNode ?? 0;

    historian.extractEvents(
        historyReadDetails,
        maxNumberToExtract,
        /* isReversed      */ false,
        /* reverseEventData*/ false,
        (err, eventData) => {
            if (err) {
                return callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadInternalError }));
            }

            const historyData = new HistoryEvent({ events: eventData ?? [] });
            return callback(
                null,
                new HistoryReadResult({
                    historyData,
                    statusCode: StatusCodes.Good
                })
            );
        }
    );
}

// ---------------------------------------------------------------------------
// Public install function
// ---------------------------------------------------------------------------

/**
 * Install event-history support on a notifier UAObject.
 *
 * After this call:
 *   - node.historyRead(context, ReadEventDetails, ...) dispatches to the historian.
 *   - node.eventNotifier has the HistoryRead bit set.
 *   - Every event that flows through node.on("event", ...) is pushed into the historian.
 *   - The address space tracks the node in `historizingEventNodes` for bulk ops.
 */
export function AddressSpace_installHistoricalEventNode(
    this: IAddressSpace,
    node: UAObject,
    options?: IEventHistorianOptions
): void {
    assert(node.nodeClass === 1 /* NodeClass.Object */, "installHistoricalEventNode: node must be a UAObject");

    AddressSpace.eventHistorianFactory = AddressSpace.eventHistorianFactory || {
        create(_node: UAObject, options1: IEventHistorianOptions): IEventHistorian {
            return new EventHistorian(options1);
        }
    };

    options = options || Object.create(null);

    const historian: IEventHistorian =
        (options as any).historian || AddressSpace.eventHistorianFactory.create(node, options!);

    (node as any).$eventHistorian = historian;
    (node as any)._historyRead = _historyReadForEvents;

    // Auto-capture: every event that bubbles through this node goes into the historian.
    node.on("event", (eventData: IEventData) => {
        historian.push(eventData).catch((err) => {
            // Best-effort: historian push must not crash the event pipeline.
            // eslint-disable-next-line no-console
            console.warn(`[installHistoricalEventNode] historian.push rejected: ${err}`);
        });
    });

    // Flip EventNotifier.HistoryRead so clients browsing metadata know the node is history-capable.
    // tslint:disable-next-line:no-bitwise
    const current = (node.eventNotifier as unknown as number) ?? 0;
    node.setEventNotifier((current | EventNotifierFlags.HistoryRead) as EventNotifierFlags);

    // OPC UA Part 11 §5.4.3 — instantiate the HistoricalEventConfigurationType child
    // ("HA Configuration") on the notifier. This is the counterpart to the
    // HistoricalDataConfiguration child that installHistoricalDataNode creates.
    // If the loaded NodeSet doesn't contain the type (very old nodesets), we
    // silently skip — the feature still works, just without the metadata.
    installHistoricalEventConfiguration(node);

    const addressSpaceAny = node.addressSpace as unknown as {
        historizingEventNodes?: Set<UAObject>;
    };
    addressSpaceAny.historizingEventNodes = addressSpaceAny.historizingEventNodes || new Set<UAObject>();
    addressSpaceAny.historizingEventNodes.add(node);
}

/**
 * Attach a "HA Configuration" child of type HistoricalEventConfigurationType
 * to the notifier, per OPC UA Part 11 §5.4.3. Populates StartOfArchive /
 * StartOfOnlineArchive with "now" so clients get useful bounds. Silently
 * no-ops when the type is missing from the loaded NodeSet.
 */
function installHistoricalEventConfiguration(node: UAObject): void {
    const addressSpace = node.addressSpace;
    const configType: any = addressSpace.findObjectType("HistoricalEventConfigurationType");
    if (!configType) {
        return;
    }

    const optionals = ["EventTypes", "StartOfArchive", "StartOfOnlineArchive", "SortByEventFields"];
    const haConfig: any = configType.instantiate({
        browseName: { name: "HA Configuration", namespaceIndex: 0 },
        optionals
    });

    node.addReference({
        isForward: true,
        nodeId: haConfig.nodeId,
        referenceType: "HasHistoricalConfiguration"
    });

    const now = new Date();
    const startOfArchive = haConfig.getPropertyByName?.("StartOfArchive");
    startOfArchive?.setValueFromSource({ dataType: "DateTime", value: now });

    const startOfOnlineArchive = haConfig.getPropertyByName?.("StartOfOnlineArchive");
    startOfOnlineArchive?.setValueFromSource({ dataType: "DateTime", value: now });
}