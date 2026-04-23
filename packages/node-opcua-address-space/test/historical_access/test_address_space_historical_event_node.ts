// tslint:disable:max-line-length
import fs from "fs";

import should from "should";

import { nodesets } from "node-opcua-nodesets";
import {
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-service-history";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { coerceNodeId } from "node-opcua-nodeid";
import {
    EventFilter,
    HistoryEvent,
    HistoryEventFieldList,
    HistoryReadResult,
    SimpleAttributeOperand
} from "node-opcua-types";
import {
    EventNotifierFlags,
    IEventData,
    IEventHistorian,
    UAObject
} from "node-opcua-address-space-base";

import {
    AddressSpace,
    ContinuationPointManager,
    SessionContext
} from "../..";
import { generateAddressSpace } from "../../nodeJS";
import { EventHistorian } from "../../src/historical_access/address_space_historical_event_node";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("Testing Historical Event Node (analogous to IVariableHistorian test suite)", () => {
    let addressSpace: AddressSpace;

    const context = new SessionContext({
        session: {
            continuationPointManager: new ContinuationPointManager(),
            getSessionId: () => coerceNodeId(1)
        }
    });

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        await generateAddressSpace(addressSpace, xml_files);
    });

    after(() => {
        addressSpace.dispose();
    });

    // Fresh namespace + notifier node per test so they don't share state.
    function mkNotifier(browseName: string): UAObject {
        const ns = addressSpace.registerNamespace(`TestNs-${browseName}-${Date.now()}-${Math.random()}`);
        return ns.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName,
            eventNotifier: EventNotifierFlags.SubscribeToEvents
        });
    }

    function makeReadEventDetails(numValuesPerNode = 100): ReadEventDetails {
        return new ReadEventDetails({
            startTime: new Date(Date.now() - 60_000),
            endTime: new Date(Date.now() + 1_000),
            numValuesPerNode,
            filter: new EventFilter({
                selectClauses: [
                    new SimpleAttributeOperand({ browsePath: [{ namespaceIndex: 0, name: "Message" }] })
                ]
            })
        });
    }

    // Variant with no selectClauses so the default EventHistorian can project
    // without needing a fully-wired IEventData mock (avoids FilterContext
    // hitting `.browsePath()` on a partial stub).
    function makeBareReadEventDetails(opts: {
        startTime?: Date;
        endTime?: Date;
        numValuesPerNode?: number;
    } = {}): ReadEventDetails {
        return new ReadEventDetails({
            startTime: opts.startTime ?? new Date(Date.now() - 60_000),
            endTime: opts.endTime ?? new Date(Date.now() + 1_000),
            numValuesPerNode: opts.numValuesPerNode ?? 100,
            filter: new EventFilter({ selectClauses: [] })
        });
    }

    const fakeEventData = (): IEventData => ({
        $eventDataSource: { nodeId: coerceNodeId("ns=0;i=2253") /* Server */ } as any,
        readValue: () => new Variant({ dataType: DataType.String, value: "evt" })
    } as unknown as IEventData);

    // ======================================================================
    // HEH — install/configuration   (analog zu HHH-*)
    // ======================================================================

    it("HEH1- installHistoricalEventNode sets the HistoryRead bit on EventNotifier (analog to IVariableHistorian 'historizing=true')", () => {
        const notifier = mkNotifier("AlarmArea_HEH1");
        (notifier.eventNotifier & EventNotifierFlags.HistoryRead).should.eql(0);

        addressSpace.installHistoricalEventNode(notifier);

        (notifier.eventNotifier & EventNotifierFlags.HistoryRead)
            .should.eql(EventNotifierFlags.HistoryRead);
    });

    it("HEH2- tracks history-event nodes in addressSpace.historizingEventNodes (analog to historizingNodes)", () => {
        const notifier = mkNotifier("AlarmArea_HEH2");
        addressSpace.installHistoricalEventNode(notifier);

        const tracked = (addressSpace as any).historizingEventNodes as Set<UAObject>;
        tracked.has(notifier).should.eql(true);
    });

    it("HEH3- default EventHistorian keeps events in memory to provide historical reads (analog to HHH2)", async () => {
        const notifier = mkNotifier("AlarmArea_HEH3");
        addressSpace.installHistoricalEventNode(notifier);

        (notifier as any).emit("event", fakeEventData());
        (notifier as any).emit("event", fakeEventData());
        (notifier as any).emit("event", fakeEventData());
        await sleep(5);

        const result: HistoryReadResult = await (notifier as any).historyRead(
            context,
            makeBareReadEventDetails(),
            null,
            null,
            {}
        );

        result.statusCode.should.eql(StatusCodes.Good);
        ((result.historyData as HistoryEvent).events || []).length.should.eql(3);
    });

    it("HEH1b- should attach a 'HA Configuration' child of type HistoricalEventConfigurationType (Part 11 §5.4.3, analog HHH1)", () => {
        const notifier = mkNotifier("AlarmArea_HEH1b");

        // Guard: HistoricalEventConfigurationType is only present in OPC UA 1.05+
        // nodesets. Skip the assertion for older standard nodesets.
        if (!addressSpace.findObjectType("HistoricalEventConfigurationType")) {
            console.warn("HistoricalEventConfigurationType not present in loaded nodeset — test skipped");
            return;
        }

        addressSpace.installHistoricalEventNode(notifier);

        const refs = notifier.findReferencesAsObject("HasHistoricalConfiguration", true);
        refs.length.should.eql(1, "expected a HasHistoricalConfiguration reference");

        const haConfig = refs[0] as UAObject;
        (haConfig as any).typeDefinitionObj.browseName.name.should.eql("HistoricalEventConfigurationType");
    });

    it("HEH4- EventNotifier HistoryRead bit can be cleared via setEventNotifier (analog to HHH4 #420)", () => {
        const notifier = mkNotifier("AlarmArea_HEH4");
        addressSpace.installHistoricalEventNode(notifier);

        (notifier.eventNotifier & EventNotifierFlags.HistoryRead).should.eql(EventNotifierFlags.HistoryRead);

        notifier.setEventNotifier(EventNotifierFlags.SubscribeToEvents);
        (notifier.eventNotifier & EventNotifierFlags.HistoryRead).should.eql(0);

        notifier.setEventNotifier(EventNotifierFlags.SubscribeToEvents | EventNotifierFlags.HistoryRead);
        (notifier.eventNotifier & EventNotifierFlags.HistoryRead).should.eql(EventNotifierFlags.HistoryRead);
    });

    // ======================================================================
    // HDIS — dispatcher / routing
    // ======================================================================

    it("HDIS-1 historyRead(ReadEventDetails) dispatches to the registered historian", async () => {
        const notifier = mkNotifier("AlarmArea_HDIS1");

        let captured: ReadEventDetails | null = null;
        const historian: IEventHistorian = {
            push: async () => { /* unused */ },
            extractEvents: (details, _max, _reversed, _rev, cb) => {
                captured = details;
                cb(null, [new HistoryEventFieldList({
                    eventFields: [new Variant({ dataType: DataType.String, value: "alarm-1" })]
                })]);
            }
        };
        addressSpace.installHistoricalEventNode(notifier, { historian });

        const result: HistoryReadResult = await (notifier as any).historyRead(
            context,
            makeReadEventDetails(),
            null,
            null,
            {}
        );

        result.statusCode.should.eql(StatusCodes.Good);
        should.exist(captured);
        ((result.historyData as HistoryEvent).events || []).length.should.eql(1);
    });

    it("HDIS-2 historyRead(ReadRawModifiedDetails) on a notifier returns BadHistoryOperationUnsupported", async () => {
        const notifier = mkNotifier("AlarmArea_HDIS2");
        addressSpace.installHistoricalEventNode(notifier);

        const result: HistoryReadResult = await (notifier as any).historyRead(
            context,
            new ReadRawModifiedDetails({
                isReadModified: false,
                startTime: new Date(0),
                endTime: new Date(),
                numValuesPerNode: 10,
                returnBounds: false
            }),
            null,
            null,
            {}
        );

        result.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);
    });

    it("HDIS-3 UAObject without installHistoricalEventNode returns BadHistoryOperationUnsupported", async () => {
        const notifier = mkNotifier("AlarmArea_HDIS3");

        const result: HistoryReadResult = await (notifier as any).historyRead(
            context,
            makeReadEventDetails(),
            null,
            null,
            {}
        );

        result.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);
    });

    it("HDIS-4 historyRead(ReadProcessedDetails) on a notifier returns BadHistoryOperationUnsupported (analog HRPD-1)", async () => {
        const notifier = mkNotifier("AlarmArea_HDIS4");
        addressSpace.installHistoricalEventNode(notifier);

        const result: HistoryReadResult = await (notifier as any).historyRead(
            context,
            new ReadProcessedDetails({}),
            null,
            null,
            {}
        );

        result.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);
    });

    it("HDIS-5 historyRead(ReadAtTimeDetails) on a notifier returns BadHistoryOperationUnsupported (analog HRAT-1)", async () => {
        const notifier = mkNotifier("AlarmArea_HDIS5");
        addressSpace.installHistoricalEventNode(notifier);

        const result: HistoryReadResult = await (notifier as any).historyRead(
            context,
            new ReadAtTimeDetails({}),
            null,
            null,
            {}
        );

        result.statusCode.should.eql(StatusCodes.BadHistoryOperationUnsupported);
    });

    // ======================================================================
    // HREE — ReadEventDetails time window + order  (analog HRRM-*)
    // ======================================================================

    it("HREE-0 default EventHistorian returns an empty HistoryEvent on a cold read", async () => {
        const notifier = mkNotifier("AlarmArea_HREE0");
        addressSpace.installHistoricalEventNode(notifier);

        const result: HistoryReadResult = await (notifier as any).historyRead(
            context,
            makeBareReadEventDetails(),
            null,
            null,
            {}
        );

        result.statusCode.should.eql(StatusCodes.Good);
        ((result.historyData as HistoryEvent).events || []).length.should.eql(0);
    });

    it("HREE-1 should filter by startTime — events older than startTime are excluded (analog HRRM-1)", async () => {
        const hist = new EventHistorian({ maxOnlineEvents: 10 });

        // Push one "old" event then fake a recent one with manual timestamp manipulation.
        // The ring captures Date.now() at push time, so sleep to push the clock forward.
        await hist.push(fakeEventData());
        await sleep(50);
        const cutover = new Date();
        await sleep(50);
        await hist.push(fakeEventData());
        await hist.push(fakeEventData());

        await new Promise<void>((resolve, reject) => {
            hist.extractEvents(
                makeBareReadEventDetails({ startTime: cutover }),
                50,
                /* isReversed */ false,
                /* reverseEventData */ false,
                (err, eventData) => {
                    if (err) return reject(err);
                    try {
                        (eventData ?? []).length.should.eql(2, "should exclude the pre-cutover event");
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    });

    it("HREE-2 should filter by endTime — events after endTime are excluded (analog HRRM-2)", async () => {
        const hist = new EventHistorian({ maxOnlineEvents: 10 });

        await hist.push(fakeEventData());
        await hist.push(fakeEventData());
        await sleep(50);
        const cutover = new Date();
        await sleep(50);
        await hist.push(fakeEventData());

        await new Promise<void>((resolve, reject) => {
            hist.extractEvents(
                makeBareReadEventDetails({ endTime: cutover }),
                50,
                false,
                false,
                (err, eventData) => {
                    if (err) return reject(err);
                    try {
                        (eventData ?? []).length.should.eql(2, "should exclude the post-cutover event");
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    });

    it("HREE-4 should support reverse order via isReversed=true (analog HRRM-4)", async () => {
        const hist = new EventHistorian({ maxOnlineEvents: 10 });

        await hist.push(fakeEventData());
        await hist.push(fakeEventData());
        await hist.push(fakeEventData());

        // Reverse order shouldn't change the count — we assert it here;
        // actual event-field comparison is out of scope without selectClauses.
        await new Promise<void>((resolve, reject) => {
            hist.extractEvents(
                makeBareReadEventDetails(),
                50,
                /* isReversed */ true,
                false,
                (err, eventData) => {
                    if (err) return reject(err);
                    try {
                        (eventData ?? []).length.should.eql(3);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    });

    it("HREE-6 should respect maxNumberToExtract (numValuesPerNode) cap", async () => {
        const hist = new EventHistorian({ maxOnlineEvents: 100 });
        for (let i = 0; i < 20; i++) await hist.push(fakeEventData());

        await new Promise<void>((resolve, reject) => {
            hist.extractEvents(
                makeBareReadEventDetails({ numValuesPerNode: 5 }),
                5,
                false,
                false,
                (err, eventData) => {
                    if (err) return reject(err);
                    try {
                        (eventData ?? []).length.should.eql(5);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    });

    // ======================================================================
    // EH — default EventHistorian mechanics
    // ======================================================================

    it("EH1- push() and extractEvents() round-trip through the default EventHistorian", async () => {
        const hist = new EventHistorian({ maxOnlineEvents: 10 });

        await hist.push(fakeEventData());
        await hist.push(fakeEventData());
        await hist.push(fakeEventData());

        await new Promise<void>((resolve, reject) => {
            hist.extractEvents(
                makeBareReadEventDetails(),
                50,
                false,
                false,
                (err, eventData) => {
                    if (err) return reject(err);
                    try {
                        (eventData ?? []).length.should.eql(3);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    });

    it("EH2- default EventHistorian ring buffer drops oldest when over capacity (analog HHM3)", async () => {
        const hist = new EventHistorian({ maxOnlineEvents: 2 });

        await hist.push(fakeEventData());
        await hist.push(fakeEventData());
        await hist.push(fakeEventData());
        await hist.push(fakeEventData());

        await new Promise<void>((resolve, reject) => {
            hist.extractEvents(
                makeBareReadEventDetails(),
                50,
                false,
                false,
                (err, eventData) => {
                    if (err) return reject(err);
                    try {
                        (eventData ?? []).length.should.eql(2);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    });

    it("EH3- install subscribes to node.on('event') and auto-captures pushed events", async () => {
        const notifier = mkNotifier("AlarmArea_EH3");

        let pushed = 0;
        const historian: IEventHistorian = {
            push: async () => { pushed++; },
            extractEvents: (_d, _m, _r, _rev, cb) => cb(null, [])
        };
        addressSpace.installHistoricalEventNode(notifier, { historian });

        (notifier as any).emit("event", fakeEventData());
        await sleep(10);

        pushed.should.eql(1);
    });

    it("EH5- raiseEvent() → bubbles through notifier → auto-captured by historian (spec-path E2E)", async () => {
        const notifier = mkNotifier("AlarmArea_EH5");

        let pushCount = 0;
        const historian: IEventHistorian = {
            push: async () => { pushCount++; },
            extractEvents: (_d, _m, _r, _rev, cb) => cb(null, [])
        };
        addressSpace.installHistoricalEventNode(notifier, { historian });

        // Build the canonical spec path: raiseEvent(eventType, data).
        // BaseEventType is guaranteed to be present in the standard nodeset.
        const baseEventType = addressSpace.findEventType("BaseEventType");
        should.exist(baseEventType, "BaseEventType must be present");

        notifier.raiseEvent(baseEventType!, {
            sourceName: { dataType: DataType.String, value: "unit-test" },
            message: { dataType: DataType.LocalizedText, value: { text: "raised-event-1" } },
            severity: { dataType: DataType.UInt16, value: 100 }
        });

        await sleep(10);

        pushCount.should.be.greaterThanOrEqual(1, "historian should have received the raised event");
    });

    it("EH4- should be easy to enumerate UAObjects with event history from an addressSpace (analog enumeration test)", () => {
        const a = mkNotifier("Enum_A");
        const b = mkNotifier("Enum_B");
        const c = mkNotifier("Enum_C"); // not installed
        c; // keep reference

        addressSpace.installHistoricalEventNode(a);
        addressSpace.installHistoricalEventNode(b);

        const tracked = (addressSpace as any).historizingEventNodes as Set<UAObject>;
        tracked.has(a).should.eql(true);
        tracked.has(b).should.eql(true);
    });
});