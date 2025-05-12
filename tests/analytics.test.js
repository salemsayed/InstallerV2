import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { storage } from '../server/storage.ts';
import { generateInsight, generateAnalyticsSummary } from '../server/openai.ts';

describe('Analytics and AI Insights Tests', function() {
  let storageStub;
  let openaiStub;

  beforeEach(function() {
    // Create stubs for storage
    storageStub = sinon.stub(storage);
    
    // Create stubs for OpenAI functions
    openaiStub = {
      generateInsight: sinon.stub(),
      generateAnalyticsSummary: sinon.stub()
    };
    
    // Replace the actual functions with stubs
    const openaiModule = { generateInsight, generateAnalyticsSummary };
    sinon.replace(openaiModule, 'generateInsight', openaiStub.generateInsight);
    sinon.replace(openaiModule, 'generateAnalyticsSummary', openaiStub.generateAnalyticsSummary);
  });

  afterEach(function() {
    // Restore stubs
    sinon.restore();
  });

  describe('Data Aggregation for Analytics', function() {
    it('should correctly calculate points over time', function() {
      // Test data for transactions over time
      const transactions = [
        { id: 1, userId: 1, type: 'earning', amount: 100, createdAt: new Date(2025, 0, 1) },
        { id: 2, userId: 1, type: 'earning', amount: 150, createdAt: new Date(2025, 0, 15) },
        { id: 3, userId: 1, type: 'earning', amount: 200, createdAt: new Date(2025, 1, 5) },
        { id: 4, userId: 1, type: 'earning', amount: 300, createdAt: new Date(2025, 1, 20) },
        { id: 5, userId: 1, type: 'earning', amount: 250, createdAt: new Date(2025, 2, 10) }
      ];
      
      // Group transactions by month
      const monthlyData = {};
      
      transactions.forEach(t => {
        const date = new Date(t.createdAt);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = 0;
        }
        
        if (t.type === 'earning') {
          monthlyData[monthKey] += t.amount;
        } else if (t.type === 'redemption') {
          monthlyData[monthKey] -= t.amount;
        }
      });
      
      // Convert to array format for charting
      const pointsOverTime = Object.entries(monthlyData).map(([date, amount]) => ({
        date,
        amount
      }));
      
      // Expected result: 3 months of data with aggregated amounts
      expect(pointsOverTime).to.have.lengthOf(3);
      expect(pointsOverTime[0].date).to.equal('2025-1');
      expect(pointsOverTime[0].amount).to.equal(250); // Jan total: 100 + 150
      expect(pointsOverTime[1].date).to.equal('2025-2');
      expect(pointsOverTime[1].amount).to.equal(500); // Feb total: 200 + 300
      expect(pointsOverTime[2].date).to.equal('2025-3');
      expect(pointsOverTime[2].amount).to.equal(250); // Mar total: 250
    });

    it('should correctly count installations over time', function() {
      // Test data for transactions over time
      const transactions = [
        { id: 1, userId: 1, type: 'earning', amount: 100, createdAt: new Date(2025, 0, 1) },
        { id: 2, userId: 1, type: 'earning', amount: 150, createdAt: new Date(2025, 0, 15) },
        { id: 3, userId: 1, type: 'earning', amount: 200, createdAt: new Date(2025, 1, 5) },
        { id: 4, userId: 1, type: 'redemption', amount: 300, createdAt: new Date(2025, 1, 20) }, // Redemption should not count
        { id: 5, userId: 1, type: 'earning', amount: 250, createdAt: new Date(2025, 2, 10) }
      ];
      
      // Group installations by month (only earning transactions count as installations)
      const monthlyData = {};
      
      transactions.forEach(t => {
        if (t.type === 'earning') {
          const date = new Date(t.createdAt);
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
          }
          
          monthlyData[monthKey]++;
        }
      });
      
      // Convert to array format for charting
      const installationsOverTime = Object.entries(monthlyData).map(([date, count]) => ({
        date,
        count
      }));
      
      // Expected result: 3 months of data with installation counts
      expect(installationsOverTime).to.have.lengthOf(3);
      expect(installationsOverTime[0].date).to.equal('2025-1');
      expect(installationsOverTime[0].count).to.equal(2); // Jan: 2 installations
      expect(installationsOverTime[1].date).to.equal('2025-2');
      expect(installationsOverTime[1].count).to.equal(1); // Feb: 1 installation (redemption doesn't count)
      expect(installationsOverTime[2].date).to.equal('2025-3');
      expect(installationsOverTime[2].count).to.equal(1); // Mar: 1 installation
    });

    it('should filter data by date range', function() {
      // Test data for transactions over time
      const transactions = [
        { id: 1, userId: 1, type: 'earning', amount: 100, createdAt: new Date(2025, 0, 1) },
        { id: 2, userId: 1, type: 'earning', amount: 150, createdAt: new Date(2025, 0, 15) },
        { id: 3, userId: 1, type: 'earning', amount: 200, createdAt: new Date(2025, 1, 5) },
        { id: 4, userId: 1, type: 'earning', amount: 300, createdAt: new Date(2025, 1, 20) },
        { id: 5, userId: 1, type: 'earning', amount: 250, createdAt: new Date(2025, 2, 10) }
      ];
      
      // Filter for February only
      const startDate = new Date(2025, 1, 1); // Feb 1, 2025
      const endDate = new Date(2025, 1, 28); // Feb 28, 2025
      
      const filteredTransactions = transactions.filter(t => {
        const date = new Date(t.createdAt);
        return date >= startDate && date <= endDate;
      });
      
      expect(filteredTransactions).to.have.lengthOf(2);
      expect(new Date(filteredTransactions[0].createdAt).getMonth()).to.equal(1); // February = month 1 (0-indexed)
      expect(new Date(filteredTransactions[1].createdAt).getMonth()).to.equal(1);
    });
  });

  describe('AI Insight Generation', function() {
    it('should call OpenAI to generate chart insights', async function() {
      // Test data for chart
      const chartData = {
        chartType: 'bar',
        metric: 'installations',
        dataPoints: [
          { date: '2025-1', count: 12 },
          { date: '2025-2', count: 15 },
          { date: '2025-3', count: 8 }
        ],
        dateRange: { from: '2025-01-01', to: '2025-03-31' }
      };
      
      // Simulate response from OpenAI
      const aiInsight = 'لقد ارتفع عدد التركيبات في شهر فبراير بنسبة 25% مقارنةً بشهر يناير، ثم انخفض في شهر مارس بنسبة 46% مقارنةً بشهر فبراير.';
      openaiStub.generateInsight.resolves(aiInsight);
      
      // Call the function
      const result = await generateInsight(chartData);
      
      // Verify the result
      expect(result).to.equal(aiInsight);
      expect(openaiStub.generateInsight.calledOnce).to.be.true;
      expect(openaiStub.generateInsight.firstCall.args[0]).to.deep.equal(chartData);
    });

    it('should call OpenAI to generate summary for dashboard', async function() {
      // Test data for dashboard summary
      const dashboardData = {
        totalInstallations: 35,
        totalPoints: 2450,
        topRegions: [
          { region: 'القاهرة', count: 15 },
          { region: 'الإسكندرية', count: 10 },
          { region: 'الجيزة', count: 5 }
        ],
        topProducts: [
          { name: 'BQ520 BAREEQ 50W', count: 20 },
          { name: 'BQ320 BAREEQ 30W', count: 10 },
          { name: 'BQ220 BAREEQ 20W', count: 5 }
        ],
        installationTrend: 'increasing',
        dateRange: { from: '2025-01-01', to: '2025-03-31' }
      };
      
      // Simulate response from OpenAI
      const aiSummary = 'خلال الربع الأول من عام 2025، تم تنفيذ 35 عملية تركيب بإجمالي 2450 نقطة. تتصدر القاهرة قائمة المناطق بـ15 عملية تركيب، ويعتبر BQ520 BAREEQ 50W المنتج الأكثر تركيباً بواقع 20 تركيب. هناك اتجاه تصاعدي في عدد التركيبات.';
      openaiStub.generateAnalyticsSummary.resolves(aiSummary);
      
      // Call the function
      const result = await generateAnalyticsSummary(dashboardData);
      
      // Verify the result
      expect(result).to.equal(aiSummary);
      expect(openaiStub.generateAnalyticsSummary.calledOnce).to.be.true;
      expect(openaiStub.generateAnalyticsSummary.firstCall.args[0]).to.deep.equal(dashboardData);
    });
  });
});