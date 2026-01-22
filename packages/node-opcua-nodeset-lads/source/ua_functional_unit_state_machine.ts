// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAStateVariable } from "node-opcua-nodeset-ua/dist/ua_state_variable"
import { UAFunctionalStateMachine, UAFunctionalStateMachine_Base } from "./ua_functional_state_machine"
export interface UAFunctionalUnitStateMachine_currentState<T extends LocalizedText> extends Omit<UAStateVariable<T>, "effectiveDisplayName"> { // Variable
      effectiveDisplayName: UAProperty<LocalizedText, DataType.LocalizedText>;
}
/**
 * Represents the state of a FunctionalUnit in a
 * LADS Device
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FunctionalUnitStateMachineType i=1043                       |
 * |isAbstract      |false                                                       |
 */
export interface UAFunctionalUnitStateMachine_Base extends UAFunctionalStateMachine_Base {
    start?: UAMethod;
    startProgram?: UAMethod;
    currentState: UAFunctionalUnitStateMachine_currentState<LocalizedText>;
}
export interface UAFunctionalUnitStateMachine extends Omit<UAFunctionalStateMachine, "currentState">, UAFunctionalUnitStateMachine_Base {
}