/**
 * @packageDocumentation
 * @module CTypeSchema
 * @preferred
 */

export const CTypeModel = {
  $id: 'http://kilt-protocol.org/draft-01/ctype#',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    $id: {
      type: 'string',
      format: 'uri',
      pattern: '^kilt:ctype:0x[0-9a-f]+$',
    },
    $schema: {
      type: 'string',
      format: 'uri',
      default: 'http://kilt-protocol.org/draft-01/ctype#',
      enum: ['http://kilt-protocol.org/draft-01/ctype#'],
    },
    title: {
      type: 'string',
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
            $ref: {
              type: 'string',
              format: 'uri',
            },
            format: {
              type: 'string',
              enum: ['date', 'time', 'uri'],
            },
          },
          additionalProperties: false,
          oneOf: [
            {
              required: ['type'],
            },
            {
              required: ['$ref'],
            },
          ],
        },
      },
    },
  },
  additionalProperties: false,
  required: ['$id', 'title', '$schema', 'properties', 'type'],
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
    owner: { type: ['string', 'null'] },
    hash: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['schema', 'hash'],
}

export const MetadataModel = {
  $id: 'http://kilt-protocol.org/draft-01/ctype-metadata',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    metadata: {
      type: 'object',
      properties: {
        title: {
          type: 'object',
          properties: {
            default: {
              type: 'string',
            },
          },
          patternProperties: {
            '^.*$': {
              type: 'string',
            },
          },
          required: ['default'],
        },
        description: {
          type: 'object',
          properties: {
            default: {
              type: 'string',
            },
          },
          patternProperties: {
            '^.*$': {
              type: 'string',
            },
          },
          required: ['default'],
        },
        properties: {
          type: 'object',
          properties: {},
          patternProperties: {
            '^.*$': {
              type: 'object',
              properties: {
                title: {
                  type: 'object',
                  properties: {
                    default: {
                      type: 'string',
                    },
                  },
                  patternProperties: {
                    '^.*$': {
                      type: 'string',
                    },
                  },
                  required: ['default'],
                },
                description: {
                  type: 'object',
                  properties: {
                    default: {
                      type: 'string',
                    },
                  },
                  patternProperties: {
                    '^.*$': {
                      type: 'string',
                    },
                  },
                  required: ['default'],
                },
              },
              required: ['title'],
              additionalProperties: false,
            },
          },
        },
      },
      required: ['title', 'properties'],
      additionalProperties: false,
    },
    ctypeHash: { type: 'string', minLength: 1 },
  },
  required: ['metadata', 'ctypeHash'],
  additionalProperties: false,
}
