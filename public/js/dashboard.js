document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [user, teamsResult, tasksResult] = await Promise.all([App.requireAuth(), App.api('/api/teams'), App.api('/api/tasks')]);
    const teams = teamsResult.teams;
    const tasks = tasksResult.tasks;
    document.getElementById('welcomeHeading').textContent = `Good to see you, ${user.name.split(' ')[0]}.`;
    const today = new Date();
    const weekAhead = new Date(today); weekAhead.setDate(today.getDate() + 7);
    const open = tasks.filter((task) => task.status !== 'COMPLETED');
    const dueSoon = open.filter((task) => task.dueDate && new Date(task.dueDate) <= weekAhead);
    document.getElementById('dashboardMetrics').innerHTML = [[teams.length, 'My teams', 'bi-people'], [open.length, 'Open tasks', 'bi-list-check'], [dueSoon.length, 'Due this week', 'bi-calendar3']].map(([value, label, icon]) => `<div class="col-md-4"><div class="metric-card"><span><i class="bi ${icon} me-2 text-primary"></i>${label}</span><strong>${value}</strong></div></div>`).join('');
    const teamPreview = document.getElementById('teamPreview');
    teamPreview.innerHTML = teams.length ? teams.slice(0, 4).map((team) => `<div class="col-md-6"><a href="/teams/${team._id}" class="team-card"><div class="team-card-icon"><i class="bi bi-people-fill"></i></div><div><h3>${App.escapeHtml(team.name)}</h3><p>${App.escapeHtml(team.description || 'A shared workspace for this team.')}</p><span>${team.members.length} members <i class="bi bi-arrow-right ms-1"></i></span></div></a></div>`).join('') : '<div class="col-12"><div class="empty-state"><i class="bi bi-people"></i><h3>No teams yet</h3><p>Create a team or use an invite code to get started.</p><a class="btn btn-primary btn-sm" href="/teams">Go to teams</a></div></div>';
    const preview = document.getElementById('taskPreview');
    preview.innerHTML = open.length ? open.sort((a, b) => new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31')).slice(0, 5).map((task) => `<a class="task-preview-item" href="/tasks?team=${task.team._id}"><span class="priority-dot ${task.priority.toLowerCase()}"></span><div><strong>${App.escapeHtml(task.title)}</strong><small>${App.escapeHtml(task.team.name)} · ${task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}</small></div><span class="status-pill ${task.status.toLowerCase()}">${task.status.replace('_', ' ')}</span></a>`).join('') : '<div class="empty-state compact"><i class="bi bi-check2-circle"></i><p>No open tasks. Nice work.</p></div>';
  } catch (error) { App.showToast(error.message, 'danger'); }
});
