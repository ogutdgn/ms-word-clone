import { generateV2HandlerEntity } from '@core/super-converter/v3/handlers/utils';
import { translator as mergeFieldTranslator } from '../../v3/handlers/sd/mergeField/index.js';

/**
 * Node-list handler entity for the `sd:mergeField` preprocessor node — turns a
 * Word MERGEFIELD/ADDRESSBLOCK/GREETINGLINE/NEXT (+rule) field into a
 * `fieldAnnotation` PM node. MANDATORY in `docxImporter.js`'s `entities` array
 * (before `passthroughNodeHandlerEntity`): registering only in the v3
 * `translatorList` would make passthrough REFUSE the node and nothing would
 * handle it (dropped).
 *
 * @type {import("./docxImporter").NodeHandlerEntry}
 */
export const mergeFieldHandlerEntity = generateV2HandlerEntity('mergeFieldHandler', mergeFieldTranslator);
