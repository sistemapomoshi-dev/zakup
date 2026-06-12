import { describe, expect, test } from 'bun:test'

import { normalizeMoySkladFiles } from './sync'

describe('normalizeMoySkladFiles', () => {
  test('keeps file href, filename and size metadata from MoySklad entities', () => {
    expect(
      normalizeMoySkladFiles([
        {
          meta: {
            href: 'https://api.moysklad.ru/api/remap/1.2/entity/purchaseorder/order-1/files/file-1',
            type: 'files',
            mediaType: 'application/json',
          },
          filename: 'invoice.pdf',
          size: 12345,
        },
        {
          meta: {
            href: 'https://api.moysklad.ru/api/remap/1.2/entity/purchaseorder/order-1/files/file-2',
            type: 'files',
            mediaType: 'application/json',
          },
          title: 'scan.jpg',
        },
        {
          filename: 'missing-meta.pdf',
          size: 10,
        },
      ]),
    ).toEqual([
      {
        href: 'https://api.moysklad.ru/api/remap/1.2/entity/purchaseorder/order-1/files/file-1',
        filename: 'invoice.pdf',
        sizeBytes: 12345,
      },
      {
        href: 'https://api.moysklad.ru/api/remap/1.2/entity/purchaseorder/order-1/files/file-2',
        filename: 'scan.jpg',
        sizeBytes: null,
      },
    ])
  })
})
