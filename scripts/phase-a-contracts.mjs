import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = resolve("e:/Cursor/Новый проект");
const w = (rel, content) => {
  const path = resolve(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
};

w("packages/contracts/src/roles.ts", `import { z } from 'zod'\n\nexport const userRoleSchema = z.enum(['manager', 'approver', 'admin'])\n\nexport type UserRole = z.infer<typeof userRoleSchema>\n`);

w("packages/contracts/src/suppliers.ts", `import { z } from 'zod'\n\nimport { emailSchema } from './auth'\n\nexport const supplierStatusSchema = z.enum(['active', 'inactive'])\n\nexport const supplierSchema = z.object({\n  id: z.string().uuid(),\n  name: z.string().min(1).max(200),\n  email: emailSchema.nullable(),\n  status: supplierStatusSchema,\n  moyskladCounterpartyId: z.string().nullable(),\n  assignedManagerId: z.string().uuid().nullable(),\n  createdAt: z.string().datetime(),\n  updatedAt: z.string().datetime(),\n})\n\nexport const createSupplierRequestSchema = z.object({\n  name: z.string().trim().min(1).max(200),\n  email: emailSchema.optional(),\n  status: supplierStatusSchema.optional(),\n  moyskladCounterpartyId: z.string().trim().min(1).optional(),\n  assignedManagerId: z.string().uuid().optional(),\n})\n\nexport const updateSupplierRequestSchema = createSupplierRequestSchema.partial()\n\nexport const supplierListResponseSchema = z.object({\n  items: z.array(supplierSchema),\n})\n\nexport const supplierIdParamsSchema = z.object({\n  id: z.string().uuid(),\n})\n\nexport type SupplierDto = z.infer<typeof supplierSchema>\nexport type SupplierStatus = z.infer<typeof supplierStatusSchema>\nexport type CreateSupplierRequest = z.input<typeof createSupplierRequestSchema>\nexport type CreateSupplierPayload = z.output<typeof createSupplierRequestSchema>\nexport type UpdateSupplierRequest = z.input<typeof updateSupplierRequestSchema>\nexport type UpdateSupplierPayload = z.output<typeof updateSupplierRequestSchema>\nexport type SupplierListResponse = z.infer<typeof supplierListResponseSchema>\n`);

let auth = readFileSync(resolve(root, "packages/contracts/src/auth.ts"), "utf8");
if (!auth.includes("userRoleSchema")) {
  auth = auth.replace("import { z } from 'zod'", "import { z } from 'zod'\n\nimport { userRoleSchema } from './roles'");
  auth = auth.replace("  displayName: z.string().nullable(),\n  createdAt: z.string().datetime(),", "  displayName: z.string().nullable(),\n  role: userRoleSchema,\n  createdAt: z.string().datetime(),");
  w("packages/contracts/src/auth.ts", auth);
}

let index = readFileSync(resolve(root, "packages/contracts/src/index.ts"), "utf8");
if (!index.includes("./roles")) {
  w("packages/contracts/src/index.ts", index.trim() + "\nexport * from './roles'\nexport * from './suppliers'\n");
}

console.log("contracts updated");
