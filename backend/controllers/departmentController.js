import { getDepartments as notionGetDepartments, getRequests } from '../services/notionService.js';

/**
 * GET /api/departments
 * Return all active departments.
 */
export async function getDepartments(req, res, next) {
  try {
    const departments = await notionGetDepartments();
    res.status(200).json({ success: true, count: departments.length, data: departments });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/departments/:departmentId/requests
 * Return all requests belonging to the specified department.
 * departmentId corresponds to the Notion Department ID (the 'id' field from the department record).
 */
export async function getDepartmentRequests(req, res, next) {
  try {
    const { departmentId } = req.params;
    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'departmentId param is required' });
    }
    const allRequests = await getRequests();
    const allDepartments = await notionGetDepartments();
    const deptRecord = allDepartments.find(d => 
      d['Name'] === departmentId || 
      d['Department ID'] === departmentId || 
      d['Department Name'] === departmentId
    );
    const possibleMatches = deptRecord ? [
      deptRecord['Name'],
      deptRecord['Department ID'],
      deptRecord['Department Name']
    ].filter(Boolean) : [departmentId];
    
    const filtered = allRequests.filter(r => {
      const deptVal = (r.Department && r.Department.id) ? r.Department.id : (r['Department ID'] || r.Department);
      return possibleMatches.includes(deptVal);
    });
    res.status(200).json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/departments/:departmentId/overview
 * Return a summary overview for a department: total requests, by status, by priority, SLA breach count.
 */
export async function getDepartmentOverview(req, res, next) {
  try {
    const { departmentId } = req.params;
    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'departmentId param is required' });
    }
    const allRequests = await getRequests();
    const allDepartments = await notionGetDepartments();
    const deptRecord = allDepartments.find(d => 
      d['Name'] === departmentId || 
      d['Department ID'] === departmentId || 
      d['Department Name'] === departmentId
    );
    const possibleMatches = deptRecord ? [
      deptRecord['Name'],
      deptRecord['Department ID'],
      deptRecord['Department Name']
    ].filter(Boolean) : [departmentId];
    
    const deptRequests = allRequests.filter(r => {
      const deptVal = (r.Department && r.Department.id) ? r.Department.id : (r['Department ID'] || r.Department);
      return possibleMatches.includes(deptVal);
    });

    const overview = {
      total: deptRequests.length,
      byStatus: {},
      byPriority: {},
      slaBreachedCount: 0
    };
    
    const activeUnresolved = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'ESCALATED', 'SLA_BREACHED'];
    
    deptRequests.forEach(reqItem => {
      const status = reqItem.Status || 'UNKNOWN';
      overview.byStatus[status] = (overview.byStatus[status] || 0) + 1;
      
      const priority = reqItem.Priority || 'UNKNOWN';
      overview.byPriority[priority] = (overview.byPriority[priority] || 0) + 1;
      
      if (reqItem['Due At']) {
        const breached = new Date() > new Date(reqItem['Due At']);
        if (breached && activeUnresolved.includes(status)) overview.slaBreachedCount++;
      }
    });
    
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
}
