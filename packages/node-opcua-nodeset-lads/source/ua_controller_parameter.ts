// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range"
import { UAExclusiveDeviationAlarm } from "node-opcua-nodeset-ua/dist/ua_exclusive_deviation_alarm"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ControllerParameterType i=1048                              |
 * |isAbstract      |false                                                       |
 */
export interface UAControllerParameter_Base {
    /**
     * currentValue
     * CurrentValue is the current process value.
     */
    currentValue: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * targetValue
     * TargetValue is the targeted set-point value.
     */
    targetValue: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * alarmMonitor
     * AlarmMonitor indicates whether the deviation from
     * a set point exceeds the limit. See: 10000-9:
     * Alarms & Conditions | ExclusiveDeviationAlarmType.
     */
    alarmMonitor?: UAExclusiveDeviationAlarm;
}
export interface UAControllerParameter extends UAObject, UAControllerParameter_Base {
}