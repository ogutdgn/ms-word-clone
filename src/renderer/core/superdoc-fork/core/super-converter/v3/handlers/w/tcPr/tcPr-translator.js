// @ts-check
import { NodeTranslator } from '@translator';
import { createNestedPropertiesTranslator } from '@converter/v3/handlers/utils.js';
import { translator as cnfStyleTranslator } from '@converter/v3/handlers/w/cnfStyle';
import { translator as shdTranslator } from '@converter/v3/handlers/w/shd';
import { translator as tcWTranslator } from '@converter/v3/handlers/w/tcW';
import { translator as gridSpanTranslator } from '@converter/v3/handlers/w/gridSpan';
import { translator as vMergeTranslator } from '@converter/v3/handlers/w/vMerge';
import { translator as tcBordersTranslator } from '@converter/v3/handlers/w/tcBorders';
import { translator as noWrapTranslator } from '@converter/v3/handlers/w/noWrap';
import { translator as tcMarTranslator } from '@converter/v3/handlers/w/tcMar';
import { translator as textDirectionTranslator } from '@converter/v3/handlers/w/textDirection';
import { translator as tcFitTextTranslator } from '@converter/v3/handlers/w/tcFitText';
import { translator as vAlignTranslator } from '@converter/v3/handlers/w/vAlign';
import { translator as hideMarkTranslator } from '@converter/v3/handlers/w/hideMark';
import { translator as headersTranslator } from '@converter/v3/handlers/w/headers';

// Property translators for w:tcPr child elements
// Each translator handles a specific property of the table cell
/** @type {import('@translator').NodeTranslator[]} */
const propertyTranslators = [
  cnfStyleTranslator,
  tcWTranslator,
  gridSpanTranslator,
  vMergeTranslator,
  tcBordersTranslator,
  shdTranslator,
  noWrapTranslator,
  tcMarTranslator,
  textDirectionTranslator,
  tcFitTextTranslator,
  vAlignTranslator,
  hideMarkTranslator,
  headersTranslator,
];

// CT_TcPr (ECMA-376 §17.4.66, an ordered xsd:sequence) REQUIRES this child sequence. The exporter
// otherwise emits children in tableCellProperties key-insertion order, so a programmatically-added
// property exports out of sequence — e.g. setCellBorders migrates attrs.borders into
// tableCellProperties LAST, so <w:tcBorders> lands AFTER <w:tcW>/<w:shd>/<w:vAlign>, violating the
// schema. Live Word 16 tolerates this on read (COM-validated: opens clean, no repair), but strict
// OOXML consumers (Open XML SDK validator, some LibreOffice paths) reject out-of-sequence children;
// this mirrors the w:tblPr ordering fix (PR #77). Imported cells already arrive in schema order, so
// the stable-sort is a no-op for them (byte-stable round-trip).
const TCPR_XML_ORDER = [
  'w:cnfStyle', 'w:tcW', 'w:gridSpan', 'w:hMerge', 'w:vMerge', 'w:tcBorders', 'w:shd',
  'w:noWrap', 'w:tcMar', 'w:textDirection', 'w:tcFitText', 'w:vAlign', 'w:hideMark',
  'w:headers', 'w:cellIns', 'w:cellDel', 'w:cellMerge',
];

/**
 * The NodeTranslator instance for the w:tcPr element.
 * @type {import('@translator').NodeTranslator}
 */
export const translator = NodeTranslator.from(
  createNestedPropertiesTranslator('w:tcPr', 'tableCellProperties', propertyTranslators, {}, [], TCPR_XML_ORDER),
);
