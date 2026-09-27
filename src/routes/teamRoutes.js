const router = require('express').Router();
const controller = require('../controllers/teamController');
const { protect } = require('../middleware/auth');
const { loadTeamMembership, requireTeamRole } = require('../middleware/teamAccess');

router.use(protect);
router.route('/').get(controller.listTeams).post(controller.createTeam);
router.post('/join', controller.joinTeam);
router.route('/:id').get(controller.getTeam).put(loadTeamMembership, requireTeamRole('owner', 'admin'), controller.updateTeam).delete(loadTeamMembership, controller.deleteTeam);
router.post('/:id/members', loadTeamMembership, requireTeamRole('owner', 'admin'), controller.addMember);
router.patch('/:id/members/:userId', loadTeamMembership, requireTeamRole('owner', 'admin'), controller.updateMember);
router.delete('/:id/members/:userId', loadTeamMembership, requireTeamRole('owner', 'admin'), controller.removeMember);
router.post('/:id/leave', loadTeamMembership, controller.leaveTeam);

module.exports = router;
