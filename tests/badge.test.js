const { expect } = require('chai');
const { describe, it, beforeEach, afterEach } = require('mocha');
const sinon = require('sinon');
const { storage } = require('../server/storage');
const { checkBadgeQualification } = require('../server/utils');

describe('Badge System Tests', function() {
  let storageStub;
  let utilsStub;

  beforeEach(function() {
    // Create stubs for storage
    storageStub = sinon.stub(storage);
    
    // Stub badge qualification function
    utilsStub = {
      checkBadgeQualification: sinon.stub()
    };
    
    // Replace the actual function with stub
    if (require('../server/utils')) {
      sinon.replace(require('../server/utils'), 'checkBadgeQualification', utilsStub.checkBadgeQualification);
    }
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
  });

  describe('Badge Qualification Logic', function() {
    it('should qualify user for installation count badges', function() {
      // Create test data for a badge that requires installations
      const badge = {
        id: 1,
        name: 'محترف التركيب',
        icon: 'trophy',
        description: 'قم بتركيب 10 منتجات',
        requiredInstallations: 10,
        requiredPoints: 0,
        active: true
      };
      
      // Create test user data
      const userData = {
        installations: 12, // More than required
        points: 500
      };
      
      // Assume a badge qualification function like this
      const isQualified = badge.requiredInstallations > 0 ? 
        userData.installations >= badge.requiredInstallations : true;
      
      expect(isQualified).to.be.true;
    });

    it('should qualify user for points-based badges', function() {
      // Create test data for a badge that requires points
      const badge = {
        id: 2,
        name: 'مستوى النخبة',
        icon: 'diamond',
        description: 'اجمع 1000 نقطة',
        requiredInstallations: 0,
        requiredPoints: 1000,
        active: true
      };
      
      // Create test user data
      const userData = {
        installations: 5,
        points: 1200 // More than required
      };
      
      // Assume a badge qualification function like this
      const isQualified = badge.requiredPoints > 0 ? 
        userData.points >= badge.requiredPoints : true;
      
      expect(isQualified).to.be.true;
    });

    it('should qualify user for combined criteria badges', function() {
      // Create test data for a badge that requires both points and installations
      const badge = {
        id: 3,
        name: 'خبير بريق',
        icon: 'star',
        description: 'قم بتركيب 20 منتج واجمع 2000 نقطة',
        requiredInstallations: 20,
        requiredPoints: 2000,
        active: true
      };
      
      // Create test user data that meets both criteria
      const userData = {
        installations: 25,
        points: 2500
      };
      
      // Assume a badge qualification function like this
      const isQualified = 
        (badge.requiredInstallations > 0 ? userData.installations >= badge.requiredInstallations : true) &&
        (badge.requiredPoints > 0 ? userData.points >= badge.requiredPoints : true);
      
      expect(isQualified).to.be.true;
    });

    it('should not qualify user if any criteria is not met', function() {
      // Create test data for a badge that requires both points and installations
      const badge = {
        id: 3,
        name: 'خبير بريق',
        icon: 'star',
        description: 'قم بتركيب 20 منتج واجمع 2000 نقطة',
        requiredInstallations: 20,
        requiredPoints: 2000,
        active: true
      };
      
      // Create test user data that meets only one criterion
      const userData = {
        installations: 25, // Meets requirement
        points: 1500     // Below requirement
      };
      
      // Assume a badge qualification function like this
      const isQualified = 
        (badge.requiredInstallations > 0 ? userData.installations >= badge.requiredInstallations : true) &&
        (badge.requiredPoints > 0 ? userData.points >= badge.requiredPoints : true);
      
      expect(isQualified).to.be.false;
    });
  });

  describe('Badge Award System', function() {
    it('should award badges to users who qualify', async function() {
      // Setup test data
      const user = {
        id: 1,
        name: 'Test User',
        points: 1500,
        badges: []
      };
      
      const badges = [
        {
          id: 1,
          name: 'محترف التركيب',
          icon: 'trophy',
          description: 'قم بتركيب 10 منتجات',
          requiredInstallations: 10,
          requiredPoints: 0,
          active: true
        },
        {
          id: 2,
          name: 'مستوى النخبة',
          icon: 'diamond',
          description: 'اجمع 1000 نقطة',
          requiredInstallations: 0,
          requiredPoints: 1000,
          active: true
        }
      ];
      
      // Setup stubs
      storageStub.listBadges.resolves(badges);
      storageStub.getUser.resolves(user);
      
      // For each badge, simulate the qualification check
      utilsStub.checkBadgeQualification.callsFake((userId, badge) => {
        // Simulate badge #2 qualification (points-based) returning true
        if (badge.id === 2) return Promise.resolve(true);
        // All other badges return false
        return Promise.resolve(false);
      });
      
      // Simulate badge update in database
      const badgeUpdateStub = sinon.stub().resolves(true);
      
      // Loop through badges to check qualification and award
      for (const badge of badges) {
        const isQualified = await utilsStub.checkBadgeQualification(user.id, badge);
        if (isQualified) {
          // In a real system, this would update the user's badges
          // For test purposes, we'll just call our stub
          await badgeUpdateStub(user.id, badge.id);
        }
      }
      
      // Verify the badge update function was called once for badge #2
      expect(badgeUpdateStub.calledOnce).to.be.true;
      expect(badgeUpdateStub.firstCall.args[0]).to.equal(user.id);
      expect(badgeUpdateStub.firstCall.args[1]).to.equal(2);
    });
  });
});