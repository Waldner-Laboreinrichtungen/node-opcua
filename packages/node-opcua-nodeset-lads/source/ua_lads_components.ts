// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAMachineComponents, UAMachineComponents_Base } from "node-opcua-nodeset-machinery/dist/ua_machine_components"
/**
 * The LADSComponentsType is a type used for
 * structuring objects of type LADSComponentsType in
 * an unordered list structure.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LADSComponentsType i=1025                                   |
 * |isAbstract      |false                                                       |
 */
export interface UALADSComponents_Base extends UAMachineComponents_Base {
    nodeVersion?: UAProperty<UAString, DataType.String>;
   // PlaceHolder for $Component$
}
export interface UALADSComponents extends Omit<UAMachineComponents, "$Component$">, UALADSComponents_Base {
}