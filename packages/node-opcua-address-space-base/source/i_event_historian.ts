/**
 * Historical Access for Events
 *
 * IEventHistorian mirrors the IVariableHistorian pattern but for
 * HistoryRead(ReadEventDetails) against UAObject / UAView notifier nodes.
 *
 * A server that wants to expose event history installs a historian via
 * addressSpace.installHistoricalEventNode(node, { historian }).
 *
 * Two entry points, matching IVariableHistorian semantics 1:1
 * (parameter names aligned, with `event` where variables use `data` / `value`):
 *
 *   push(newEventData)     — called synchronously from the event pipeline on
 *                            every `node.raiseEvent(...)` that bubbles through
 *                            an installed notifier node. Analog to
 *                            IVariableHistorian.push on value_changed.
 *
 *   extractEvents(...)     — called from HistoryRead(ReadEventDetails) to
 *                            materialise the response for a client. Returns
 *                            HistoryEventFieldList entries whose columns
 *                            align with details.filter.selectClauses.
 *
 * See OPC UA Part 11 (Historical Access) §6 for protocol details.
 */

import { HistoryEventFieldList, ReadEventDetails } from "node-opcua-types";

import { IEventData } from "./i_event_data";

export interface IEventHistorian {
    /**
     * Append a new event into the history.
     *
     * The method should take a very small amount of time and not directly
     * write to the underlying database.
     *
     * @param newEventData raw event snapshot captured from the notifier node
     */
    push(newEventData: IEventData): Promise<void>;

    /**
     * Extract a series of events from the History database for this notifier.
     *
     * @param historyReadEventDetails  time window + EventFilter (selectClauses / whereClause)
     * @param maxNumberToExtract       upper bound on returned events for this call
     * @param isReversed               read newest→oldest instead of oldest→newest
     * @param reverseEventData         reverse each extracted event's field order (rarely used)
     * @param callback                 node-style callback with HistoryEventFieldList[]
     */
    extractEvents(
        historyReadEventDetails: ReadEventDetails,
        maxNumberToExtract: number,
        isReversed: boolean,
        reverseEventData: boolean,
        callback: (err: Error | null, eventData?: HistoryEventFieldList[]) => void
    ): void;
}

export interface IEventHistorianOptions {
    /**
     * Size of the in-memory ring buffer used by the default historian.
     * Ignored when `historian` is supplied.
     */
    maxOnlineEvents?: number;
    /** Caller-provided historian. If omitted, the default factory constructs one. */
    historian?: IEventHistorian;
}

export type IHistoricalEventNodeOptions = IEventHistorianOptions;