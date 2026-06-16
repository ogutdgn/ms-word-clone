// @ts-check
import { NodeTranslator } from '@translator';
import { createNestedPropertiesTranslator } from '../../utils.js';

import { translator as bidiVisualTranslator } from '../bidiVisual';
import { translator as jcTranslator } from '../jc';
import { translator as shdTranslator } from '../shd';
import { translator as tblCaptionTranslator } from '../tblCaption';
import { translator as tblCellSpacingTranslator } from '../tblCellSpacing';
import { translator as tblDescriptionTranslator } from '../tblDescription';
import { translator as tblIndTranslator } from '../tblInd';
import { translator as tblLayoutTranslator } from '../tblLayout';
import { translator as tblLookTranslator } from '../tblLook';
import { translator as tblOverlapTranslator } from '../tblOverlap';
import { translator as tblStyleTranslator } from '../tblStyle';
import { translator as tblStyleColBandSizeTranslator } from '../tblStyleColBandSize';
import { translator as tblStyleRowBandSizeTranslator } from '../tblStyleRowBandSize';
import { translator as tblWTranslator } from '../tblW';
import { translator as tblpPrTranslator } from '../tblpPr';
import { translator as tblBordersTranslator } from '../tblBorders';
import { translator as tblCellMarTranslator } from '../tblCellMar';

// Property translators for w:tblPr child elements
// Each translator handles a specific property of the table
/** @type {import('@translator').NodeTranslator[]} */
const propertyTranslators = [
  bidiVisualTranslator,
  jcTranslator,
  shdTranslator,
  tblCaptionTranslator,
  tblCellSpacingTranslator,
  tblDescriptionTranslator,
  tblIndTranslator,
  tblLayoutTranslator,
  tblLookTranslator,
  tblOverlapTranslator,
  tblStyleTranslator,
  tblStyleColBandSizeTranslator,
  tblStyleRowBandSizeTranslator,
  tblWTranslator,
  tblpPrTranslator,
  tblBordersTranslator,
  tblCellMarTranslator,
];

// CT_TblPrBase (ECMA-376 §17.4.60) REQUIRES this exact child sequence. The exporter otherwise emits
// children in tableProperties key-insertion order, so programmatically-added properties (e.g.
// setTableAlignment → justification, setTableIndent → tableIndent) land after w:tblLook and corrupt the
// .docx (Word rejects it). Passing this order makes createNestedPropertiesTranslator sort to spec.
const TBLPR_XML_ORDER = [
  'w:tblStyle', 'w:tblpPr', 'w:tblOverlap', 'w:bidiVisual', 'w:tblStyleRowBandSize',
  'w:tblStyleColBandSize', 'w:tblW', 'w:jc', 'w:tblCellSpacing', 'w:tblInd', 'w:tblBorders',
  'w:shd', 'w:tblLayout', 'w:tblCellMar', 'w:tblLook', 'w:tblCaption', 'w:tblDescription',
];

/**
 * The NodeTranslator instance for the w:tblPr element.
 * @type {import('@translator').NodeTranslator}
 */
export const translator = NodeTranslator.from(
  createNestedPropertiesTranslator('w:tblPr', 'tableProperties', propertyTranslators, {}, [], TBLPR_XML_ORDER),
);
