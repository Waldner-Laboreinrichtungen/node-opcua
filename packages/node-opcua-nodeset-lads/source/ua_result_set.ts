// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UASet, UASet_Base } from "./ua_set"
/**
 * The ResultSetType is used for organising
 * ResultType objects in an unordered list structure.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ResultSetType i=1020                                        |
 * |isAbstract      |false                                                       |
 */
export interface UAResultSet_Base extends UASet_Base {
   // PlaceHolder for $SetElement$
    /**
     * nodeVersion
     * NodeVersion and the GeneralModelChangeEventType
     * are mechanisms to notify clients that the content
     * of the set has changed and shall be used as
     * defined in OPC 10000-3.
     */
    nodeVersion?: UAProperty<UAString, DataType.String>;
}
export interface UAResultSet extends Omit<UASet, "$SetElement$"|"nodeVersion">, UAResultSet_Base {
}