// @ts-nocheck
import { Extension } from '@core/Extension.js';

/**
 * Heading attributes
 * @typedef {Object} HeadingAttributes
 * @category Attributes
 * @property {number} level - Heading level (1-6)
 */

/**
 * Configuration options for Heading
 * @typedef {Object} HeadingOptions
 * @category Options
 * @property {number[]} [levels=[1,2,3,4,5,6]] - Supported heading levels
 */

/**
 * @module Heading
 * @sidebarTitle Heading
 * @snippetPath /snippets/extensions/heading.mdx
 */
export const Heading = Extension.create({
  name: 'heading',

  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6],
    };
  },

  addCommands() {
    return {
      /**
       * Set a heading with specified level
       * @category Command
       * @param {HeadingAttributes} attributes - Heading attributes including level
       * @example
       * editor.commands.setHeading({ level: 2 })
       * @note Converts current block to heading
       */
      setHeading:
        (attributes) =>
        ({ commands }) => {
          const containsLevel = this.options.levels.includes(attributes.level);
          if (!containsLevel) return false;
          return commands.setLinkedStyle({ id: `Heading${attributes.level}` });
        },

      /**
       * Toggle between heading and paragraph
       * @category Command
       * @param {HeadingAttributes} attributes - Heading attributes including level
       * @example
       * editor.commands.toggleHeading({ level: 1 })
       * editor.commands.toggleHeading({ level: 3 })
       * @note Switches between heading and paragraph for the same level
       */
      toggleHeading:
        (attributes) =>
        ({ commands }) => {
          const containsLevel = this.options.levels.includes(attributes.level);
          if (!containsLevel) return false;
          return commands.toggleLinkedStyle({ id: `Heading${attributes.level}` }, 'paragraph');
        },
    };
  },
});
