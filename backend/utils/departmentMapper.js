/**
 * Category-to-Department Mapping Matrix.
 * Maps category enum values to Department Name and Department ID in Notion.
 */
export const CATEGORY_DEPARTMENT_MAP = {
  MAINTENANCE: { name: 'Maintenance', id: 'DEPT-MAINT' },
  ELECTRICAL: { name: 'Maintenance', id: 'DEPT-MAINT' },
  PLUMBING: { name: 'Maintenance', id: 'DEPT-MAINT' },
  IT: { name: 'IT Helpdesk', id: 'DEPT-IT' },
  HOSTEL: { name: 'Hostel Management', id: 'DEPT-HOSTEL' },
  ACADEMIC: { name: 'Academic Department', id: 'DEPT-ACADEMIC' },
  ADMINISTRATION: { name: 'Administration', id: 'DEPT-ADMIN' },
  ACCOUNTS: { name: 'Accounts and Finance', id: 'DEPT-ACCOUNTS' },
  DOCUMENT: { name: 'Document and Certificates', id: 'DEPT-DOCUMENT' },
  SECURITY: { name: 'Security', id: 'DEPT-SECURITY' },
  OTHER: { name: 'Administration', id: 'DEPT-ADMIN' }
};

/**
 * Get mapped Department Name and Department ID from a Category string.
 *
 * @param {string} category 
 * @returns {Object} { departmentName: string, departmentId: string }
 */
export function getDepartmentForCategory(category) {
  const normalized = (category || '').toUpperCase();
  const mapped = CATEGORY_DEPARTMENT_MAP[normalized] || CATEGORY_DEPARTMENT_MAP.OTHER;
  return {
    departmentName: mapped.name,
    departmentId: mapped.id
  };
}
