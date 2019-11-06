/**
 * @module CType
 */

/**
 * Dummy comment needed for correct doc display, do not remove.
 */
// TODO: Generate from actual CTypeModel
// TODO: The SDK is not really responsible for this, since it is editor specific
export const CTypeInputModel = {
  $id: 'http://kilt-protocol.org/draft-01/ctype-input#',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CTYPE',
  type: 'object',
  properties: {
    $id: {
      title: 'Identifier',
      type: 'string',
      format: 'uri-reference',
      minLength: 1,
    },
    $schema: {
      title: 'Schema',
      type: 'string',
      format: 'uri',
      enum: ['http://kilt-protocol.org/draft-01/ctype-input#'],
      default: 'http://kilt-protocol.org/draft-01/ctype-input#',
      readonly: true,
      className: 'hidden',
    },
    title: {
      title: 'Title',
      type: 'string',
      minLength: 1,
    },
    properties: {
      title: 'Data',
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            title: 'Title',
            type: 'string',
            default: 'New Property',
            minLength: 1,
          },
          $id: {
            title: 'Identifier',
            type: 'string',
            format: 'uri-reference',
            minLength: 1,
          },
          type: {
            title: 'Type',
            type: 'string',
            enum: ['string', 'integer', 'number', 'boolean'],
            enumTitles: ['Text', 'Number', 'Decimal', 'Yes/No'],
          },
          format: {
            title: 'Format',
            type: 'string',
            enum: ['date', 'time', 'uri'],
          },
        },
        required: ['$id', 'title', 'type'],
      },
      collapsed: false,
    },
    type: {
      title: 'Object Type',
      type: 'string',
      default: 'object',
      readonly: true,
      className: 'hidden',
    },
  },
  required: ['$id', '$schema', 'title', 'properties', 'type'],
}

export const CTypeModel = {
  $id: 'http://kilt-protocol.org/draft-01/ctype#',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    $id: {
      type: 'string',
      minLength: 1,
    },
    $schema: {
      type: 'string',
      format: 'uri',
      default: 'http://kilt-protocol.org/draft-01/ctype#',
      enum: ['http://kilt-protocol.org/draft-01/ctype#'],
    },
    type: {
      type: 'string',
      enum: ['object'],
    },
    properties: {
      type: 'object',
      patternProperties: {
        '^.*$': {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['string', 'integer', 'number', 'boolean'],
            },
            format: {
              type: 'string',
              enum: ['date', 'time', 'uri'],
            },
          },
          required: ['type'],
        },
      },
    },
  },
  required: ['$id', '$schema', 'properties', 'type'],
}

export const CTypeWrapperModel = {
  $id: 'http://kilt-protocol.org/draft-01/ctype-wrapper#',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    schema: {
      type: 'object',
      properties: CTypeModel.properties,
    },
    hash: {
      type: 'string',
      minLength: 1,
    },
  },
  required: ['schema'],
}

export const CTypeWrapperMetadata = {
  metadata: {
    $id: 'http://kilt-protocol.org/draft-01/ctype-metadata',
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: {
      type: ' string',
    },
    description: {
      type: 'string',
    },
    properties: {
      type: 'object',
      properties: {},
      patternProperties: {
        '^.*$': {
          type: 'object',
          properties: {},
        },
      },
    },
  },
  ctypeHash: { type: 'string', minLength: 1 },
  required: ['metadata', 'ctypeHash'],
}

export const WrapperMetadata = {
  metadata: {
    $id: 'http://kilt-protocol.org/draft-01/ctype-metadata',
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: {
      type: ' string',
    },
    description: {
      type: 'string',
    },
    properties: {
      type: 'object',
      properties: {},
      patternProperties: {
        '^.*$': {
          type: 'object',
          properties: {},
        },
      },
    },
  },
}
