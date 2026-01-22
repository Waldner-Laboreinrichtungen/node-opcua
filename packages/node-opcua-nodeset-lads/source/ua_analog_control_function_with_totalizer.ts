// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range"
import { UAAnalogControlFunction_operational, UAAnalogControlFunction, UAAnalogControlFunction_Base } from "./ua_analog_control_function"
export interface UAAnalogControlFunctionWithTotalizer_operational extends UAAnalogControlFunction_operational { // Object
      /**
       * totalizedValue
       * TotalizedValue is the totalized process value. It
       * can be reset at any time using the
       * ResetTotalizer() command.
       */
      totalizedValue: UAAnalogUnitRange<number, DataType.Double>;
      resetTotalizer?: UAMethod;
}
/**
 * The AnalogControlFunctionWithTotalizerType
 * describes an analogue control (using analogue
 * values) function with totalizer.  Typical usage
 * examples include but are not limited to fluid
 * controllers where the quantity of fluid needs to
 * be accurately measured and totalled for metering
 * purposes.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogControlFunctionWithTotalizerType i=1014               |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogControlFunctionWithTotalizer_Base extends UAAnalogControlFunction_Base {
    /**
     * operational
     * Operational is a FunctionalGroup that shall
     * organize the CurrentState property of the
     * StateMachine and all its remote invocable
     * Methods. Furthermore, it shall organize at least
     * the CurrentValue and TargetValue variables.
     */
    operational: UAAnalogControlFunctionWithTotalizer_operational;
    /**
     * totalizedValue
     * TotalizedValue is the totalized process value. It
     * can be reset at any time using the
     * ResetTotalizer() command.
     */
    totalizedValue: UAAnalogUnitRange<number, DataType.Double>;
    resetTotalizer?: UAMethod;
}
export interface UAAnalogControlFunctionWithTotalizer extends Omit<UAAnalogControlFunction, "operational">, UAAnalogControlFunctionWithTotalizer_Base {
}