// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * This DataType contains metadata for a sample,
 * specifically data on the identification and
 * location of the sample in a container.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/LADS/                           |
 * | nodeClass |DataType                                                    |
 * | name      |SampleInfoType                                              |
 * | isAbstract|false                                                       |
 */
export interface DTSampleInfo extends DTStructure {
  /** Identifier of the container the sample is in.*/
  containerId: UAString; // String ns=0;i=12
  /** Identifier of the sample.*/
  sampleId: UAString; // String ns=0;i=12
  /** Vendor-specific description of the position of the sample in the container.*/
  position: UAString; // String ns=0;i=12
  /** Custom data field for vendor-specific data.*/
  customData: UAString; // String ns=0;i=12
}
export interface UDTSampleInfo extends ExtensionObject, DTSampleInfo {};