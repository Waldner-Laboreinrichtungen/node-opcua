// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
/**
 * The SupportedPropertyType provides alias names
 * and links to variables within the information
 * model, typically target values or parameters of
 * Functions. This makes it possible to specify a
 * list of KeyValuePairs as an input object. The
 * SupportedPropertyType is used in the
 * SupportedPropertiesSet of the FunctionalUnit or
 * ActiveProgram. The name of each Property object
 * is used as a key in the KeyValuePair list input
 * Argument of the Start()/StartFunctions() Method.
 * Each Property object should contain an Organizes
 * Reference to the target variable to which it
 * belongs. Thus, the metadata of the target
 * variable can be introspected online. The name of
 * the Property object is typically an alias for a
 * variable in the Device.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SupportedPropertyType i=1035                                |
 * |isAbstract      |false                                                       |
 */
export interface UASupportedProperty_Base {
}
export interface UASupportedProperty extends UAObject, UASupportedProperty_Base {
}