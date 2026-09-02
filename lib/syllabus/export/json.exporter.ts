/**
 * lib/syllabus/export/json.exporter.ts
 */

import type { ExportableResource } from '../models/syllabus.types';

export function renderResourceToJson(resource: ExportableResource): string {
  return JSON.stringify(resource.data, null, 2);
}
