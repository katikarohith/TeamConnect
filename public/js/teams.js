document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('teamGrid');
  async function loadTeams() {
    const { teams } = await App.api('/api/teams');
    grid.innerHTML = teams.length ? teams.map((team) => `<div class="col-md-6 col-xl-4"><article class="team-card team-card-full"><div class="d-flex justify-content-between"><div class="team-card-icon"><i class="bi bi-people-fill"></i></div><span class="role-chip">${team.currentUserRole}</span></div><h2>${App.escapeHtml(team.name)}</h2><p>${App.escapeHtml(team.description || 'No description yet. Start collaborating in this shared space.')}</p><div class="d-flex align-items-center justify-content-between mt-auto"><div class="avatar-stack">${team.members.slice(0, 4).map((member) => App.avatar(member.user, 'avatar avatar-sm')).join('')} ${team.members.length > 4 ? `<span class="avatar avatar-sm avatar-fallback">+${team.members.length - 4}</span>` : ''}</div><a href="/teams/${team._id}" class="btn btn-sm btn-primary">Open <i class="bi bi-arrow-right"></i></a></div></article></div>`).join('') : '<div class="col-12"><div class="empty-state"><i class="bi bi-people"></i><h2>Make a space for the work</h2><p>Create a team, or join one using a code from a teammate.</p></div></div>';
  }
  try { await App.requireAuth(); await loadTeams(); } catch (error) { App.showToast(error.message, 'danger'); }
  const handleForm = (id, endpoint, success) => document.getElementById(id)?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    try { const data = Object.fromEntries(new FormData(form)); const response = await App.api(endpoint, { method: 'POST', body: JSON.stringify(data) }); bootstrap.Modal.getInstance(form.closest('.modal')).hide(); form.reset(); App.showToast(success); await loadTeams(); if (response.team) location.href = `/teams/${response.team._id}`; } catch (error) { App.showToast(error.message, 'danger'); } finally { button.disabled = false; }
  });
  handleForm('createTeamForm', '/api/teams', 'Team created.');
  handleForm('joinTeamForm', '/api/teams/join', 'You joined the team.');
});
