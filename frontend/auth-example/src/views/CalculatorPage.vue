<template>
  <div :class="['calculator-container', { 'dark-theme': darkTheme }]" @contextmenu="openConsole">
    <header>
      <img :src="darkTheme ? require('@/assets/logo-dark.png') : require('@/assets/logo.png')" alt="Logo" class="logo" />
      <div class="search-container">
        <input type="text" v-model="searchQuery" @input="fetchSuggestions" placeholder="Search stocks and crypto..." />
        <ul v-if="searchQuery.length > 0" class="suggestions">
          <li v-if="suggestions.length === 0">no matchings were found</li>
          <li v-else v-for="item in suggestions.slice(0, 5)" :key="item.code" @click="selectSuggestion(item)">
            {{ item.name }} ({{ item.code }})
          </li>
        </ul>
      </div>
      <nav>
        <router-link to="/">Home</router-link>
        <router-link to="/shares">Shares</router-link>
        <router-link to="/crypto">Crypto</router-link>
        <router-link to="/portfolio">Portfolio</router-link>
        <router-link to="/calculator" class="active">Calculator</router-link>
        <router-link to="/about">About</router-link>
        <a v-if="!isLoggedIn" @click="openLogin">Sign In</a>
        <a v-if="!isLoggedIn" @click="openSignup">Sign Up</a>
        <div v-if="isLoggedIn" class="user-profile">
          <img :src="userIcon" alt="User Icon" @click="toggleProfileMenu" />
          <div v-if="showProfileMenu" class="profile-menu">
            <a @click="viewProfile">Profile</a>
            <a @click="logout">Log Out</a>
          </div>
        </div>
        <label class="theme-toggle">
          <input type="checkbox" @change="toggleTheme" :checked="darkTheme" />
          <span class="slider"></span>
        </label>
      </nav>
    </header>
    <div class="content">
      <div class="calculator">
        <h2>Financial Ratios Calculator</h2>
        <div class="formula-selector">
          <label for="formula">Select Formula:</label>
          <select id="formula" v-model="selectedFormula" @change="updateInputs">
            <option v-for="formula in formulas" :key="formula.id" :value="formula.id">{{ formula.name }}</option>
          </select>
        </div>
        <div v-for="(input, index) in formulaInputs" :key="index" class="input-group">
          <label :for="input.id">{{ input.label }}</label>
          <input type="number" v-model="input.value" :id="input.id" @input="validateInput(index)" />
          <p v-if="input.error" class="error-message">Invalid data</p>
        </div>
        <button @click="calculateFormula">Calculate</button>
        <div v-if="result !== null">
          <h3>Result:</h3>
          <p>{{ result }}</p>
        </div>
        <div v-if="selectedFormula">
          <h3 class="formula-header"><b>{{ getFormulaHeader(selectedFormula) }}</b></h3>
          <p class="formula-description">{{ getFormulaDescription(selectedFormula) }}</p>
        </div>
      </div>
    </div>
    <footer>
      <div class="footer-content">
        <div class="footer-left">
          <a href="#" class="footer-logo">Livesey</a>
          <div class="footer-social">
            <a href="#">Instagram</a>
            <a href="#">LinkedIn</a>
            <a href="#">Email</a>
          </div>
        </div>
        <div class="footer-right">
          <a href="#">About Us</a>
          <a href="#">Terms of Service</a>
          <a href="#">Editorial Policy</a>
          <a href="#">Advertise</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Contact Us</a>
        </div>
      </div>
    </footer>

    <!-- Login Modal -->
    <div v-if="showLogin" class="modal" @click.self="closeModal">
      <LoginPage @close="closeModal" @switchToSignup="openSignup" @login="handleLogin" />
    </div>

    <!-- Signup Modal -->
    <div v-if="showSignup" class="modal" @click.self="closeModal">
      <SignupPage @close="closeModal" @switchToLogin="openLogin" @signup="handleSignup" />
    </div>
  </div>
</template>

<script>
import {
  calculateCurrentRatio,
  calculateQuickRatio,
  calculateCashRatio,
  calculateNWCPercentageRevenue,
  calculateNetDebt,
  calculatePE,
  calculateForwardPE,
  calculatePEG,
  calculatePS,
  calculatePB,
  calculatePC,
  calculatePFCF,
  calculateCAPE,
  calculateEV,
  calculateEVtoEBITDA,
  calculateEVCFO,
  calculateEVFCFF,
  calculateDebtEquity,
  calculateLTDebtEquity,
  calculateEPS,
  calculateROA,
  calculateROE,
  calculateROI,
} from "livsey-finance-library";
import axios from 'axios';
import LoginPage from '@/views/LoginPage.vue';
import SignupPage from '@/views/SignupPage.vue';


export default {
  components: {
    LoginPage,
    SignupPage
  },
  created() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkTheme = true;
      document.body.classList.add('dark-theme');
    } else {
      this.darkTheme = false;
      document.body.classList.remove('dark-theme');
    }

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
        this.isLoggedIn = true;
        this.logAction('Restored User Session');
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('user'); // Clear corrupted data
        this.user = null;
        this.isLoggedIn = false;
      }
    }
  },
  data() {
    return {
      formulas: [
        { id: 'default', name: '', inputs: [] },
        { id: 'debtEquity', name: 'Debt to Equity Ratio', inputs: ['totalDebt', 'equity'] },
        { id: 'ltDebtEquity', name: 'Long Term Debt to Equity Ratio', inputs: ['longTermDebt', 'equity'] },
        { id: 'eps', name: 'Earnings Per Share', inputs: ['netIncome', 'preferredDividends', 'sharesOutstanding'] },
        { id: 'roa', name: 'Return on Assets', inputs: ['netIncome', 'totalAssets'] },
        { id: 'roe', name: 'Return on Equity', inputs: ['netIncome', 'shareholdersEquity'] },
        { id: 'roi', name: 'Return on Investment', inputs: ['currentValue', 'cost'] },
        { id: 'currentRatio', name: 'Current Ratio', inputs: ['currentAssets', 'currentLiabilities'] },
        { id: 'quickRatio', name: 'Quick Ratio', inputs: ['currentAssets', 'inventory', 'currentLiabilities'] },
        { id: 'cashRatio', name: 'Cash Ratio', inputs: ['cash', 'currentLiabilities'] },
        { id: 'nwcPercentageRevenue', name: 'NWC Percentage Revenue', inputs: ['netWorkingCapital', 'revenue'] },
        { id: 'netDebt', name: 'Net Debt', inputs: ['totalDebt', 'cash'] },
        { id: 'pe', name: 'Price to Earnings Ratio', inputs: ['marketPrice', 'earningsPerShare'] },
        { id: 'forwardPE', name: 'Forward PE Ratio', inputs: ['marketPrice', 'estimatedEarningsPerShare'] },
        { id: 'peg', name: 'Price/Earnings to Growth Ratio', inputs: ['peRatio', 'growthRate'] },
        { id: 'ps', name: 'Price to Sales Ratio', inputs: ['marketPrice', 'salesPerShare'] },
        { id: 'pb', name: 'Price to Book Ratio', inputs: ['marketPrice', 'bookValuePerShare'] },
        { id: 'pc', name: 'Price to Cash Flow Ratio', inputs: ['marketPrice', 'cashFlowPerShare'] },
        { id: 'pfcf', name: 'Price to Free Cash Flow Ratio', inputs: ['marketPrice', 'freeCashFlowPerShare'] },
        { id: 'cape', name: 'Cyclically Adjusted PE Ratio', inputs: ['marketPrice', 'averageInflationAdjustedEarnings'] },
        { id: 'ev', name: 'Enterprise Value', inputs: ['marketCapitalization', 'totalDebt', 'cash'] },
        { id: 'evToEbitda', name: 'EV/EBITDA Ratio', inputs: ['enterpriseValue', 'ebitda'] },
        { id: 'evCFO', name: 'EV/CFO Ratio', inputs: ['enterpriseValue', 'cashFlowFromOperations'] },
        { id: 'evFCFF', name: 'EV/FCFF Ratio', inputs: ['enterpriseValue', 'freeCashFlowToFirm'] },
      ],
      selectedFormula: 'default',
      inputs: {
        totalDebt: { id: 'totalDebt', label: 'Total Debt', value: null, error: false },
        equity: { id: 'equity', label: 'Equity', value: null, error: false },
        longTermDebt: { id: 'longTermDebt', label: 'Long Term Debt', value: null, error: false },
        netIncome: { id: 'netIncome', label: 'Net Income', value: null, error: false },
        preferredDividends: { id: 'preferredDividends', label: 'Preferred Dividends', value: null, error: false },
        sharesOutstanding: { id: 'sharesOutstanding', label: 'Shares Outstanding', value: null, error: false },
        totalAssets: { id: 'totalAssets', label: 'Total Assets', value: null, error: false },
        shareholdersEquity: { id: 'shareholdersEquity', label: 'Shareholders\' Equity', value: null, error: false },
        currentValue: { id: 'currentValue', label: 'Current Value', value: null, error: false },
        cost: { id: 'cost', label: 'Cost', value: null, error: false },
        currentAssets: { id: 'currentAssets', label: 'Current Assets', value: null, error: false },
        currentLiabilities: { id: 'currentLiabilities', label: 'Current Liabilities', value: null, error: false },
        inventory: { id: 'inventory', label: 'Inventory', value: null, error: false },
        cash: { id: 'cash', label: 'Cash', value: null, error: false },
        netWorkingCapital: { id: 'netWorkingCapital', label: 'Net Working Capital', value: null, error: false },
        revenue: { id: 'revenue', label: 'Revenue', value: null, error: false },
        marketPrice: { id: 'marketPrice', label: 'Market Price', value: null, error: false },
        earningsPerShare: { id: 'earningsPerShare', label: 'Earnings Per Share', value: null, error: false },
        estimatedEarningsPerShare: { id: 'estimatedEarningsPerShare', label: 'Estimated Earnings Per Share', value: null, error: false },
        peRatio: { id: 'peRatio', label: 'PE Ratio', value: null, error: false },
        growthRate: { id: 'growthRate', label: 'Growth Rate', value: null, error: false },
        salesPerShare: { id: 'salesPerShare', label: 'Sales Per Share', value: null, error: false },
        bookValuePerShare: { id: 'bookValuePerShare', label: 'Book Value Per Share', value: null, error: false },
        cashFlowPerShare: { id: 'cashFlowPerShare', label: 'Cash Flow Per Share', value: null, error: false },
        freeCashFlowPerShare: { id: 'freeCashFlowPerShare', label: 'Free Cash Flow Per Share', value: null, error: false },
        averageInflationAdjustedEarnings: { id: 'averageInflationAdjustedEarnings', label: 'Average Inflation Adjusted Earnings', value: null, error: false },
        marketCapitalization: { id: 'marketCapitalization', label: 'Market Capitalization', value: null, error: false },
        enterpriseValue: { id: 'enterpriseValue', label: 'Enterprise Value', value: null, error: false },
        ebitda: { id: 'ebitda', label: 'EBITDA', value: null, error: false },
        cashFlowFromOperations: { id: 'cashFlowFromOperations', label: 'Cash Flow From Operations', value: null, error: false },
        freeCashFlowToFirm: { id: 'freeCashFlowToFirm', label: 'Free Cash Flow To Firm', value: null, error: false },
      },
      formulaInputs: [],
      result: null,
      showLogin: false,
      showSignup: false,
      showProfileMenu: false,
      searchQuery: '',
      darkTheme: false,
      suggestions: [],
      isLoggedIn: false, // Maintain local authentication state
      user: null, // Store user data locally
    };
  },
  computed: {
    // If the user has a custom avatar, display it
    userIcon() {
      return this.user?.avatar || require('@/assets/default-user.png');
    },
  },
  methods: {
    checkLoginStatus() {
      // Check for logged-in user info in localStorage
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          this.user = JSON.parse(storedUser);
          this.isLoggedIn = true;
        } catch (error) {
          console.error('Failed to parse user data:', error);
          localStorage.removeItem('user');
        }
      }
    },
    updateInputs() {
      const selected = this.formulas.find(formula => formula.id === this.selectedFormula);
      this.formulaInputs = selected.inputs.map(inputId => this.inputs[inputId]);
    },
    calculateFormula() {
      const inputValues = this.formulaInputs.map(input => input.value);
      if (this.formulaInputs.some(input => input.error) || inputValues.some(value => value === 0 || value === null || value === '')) {
        this.result = "Invalid data or division by zero";
        return;
      }
      try {
        switch (this.selectedFormula) {
          case 'debtEquity':
            this.result = calculateDebtEquity(...inputValues);
            break;
          case 'ltDebtEquity':
            this.result = calculateLTDebtEquity(...inputValues);
            break;
          case 'eps':
            this.result = calculateEPS(...inputValues);
            break;
          case 'roa':
            this.result = calculateROA(...inputValues);
            break;
          case 'roe':
            this.result = calculateROE(...inputValues);
            break;
          case 'roi':
            this.result = calculateROI(...inputValues);
            break;
          case 'currentRatio':
            this.result = calculateCurrentRatio(...inputValues);
            break;
          case 'quickRatio':
            this.result = calculateQuickRatio(...inputValues);
            break;
          case 'cashRatio':
            this.result = calculateCashRatio(...inputValues);
            break;
          case 'nwcPercentageRevenue':
            this.result = calculateNWCPercentageRevenue(...inputValues);
            break;
          case 'netDebt':
            this.result = calculateNetDebt(...inputValues);
            break;
          case 'pe':
            this.result = calculatePE(...inputValues);
            break;
          case 'forwardPE':
            this.result = calculateForwardPE(...inputValues);
            break;
          case 'peg':
            this.result = calculatePEG(...inputValues);
            break;
          case 'ps':
            this.result = calculatePS(...inputValues);
            break;
          case 'pb':
            this.result = calculatePB(...inputValues);
            break;
          case 'pc':
            this.result = calculatePC(...inputValues);
            break;
          case 'pfcf':
            this.result = calculatePFCF(...inputValues);
            break;
          case 'cape':
            this.result = calculateCAPE(...inputValues);
            break;
          case 'ev':
            this.result = calculateEV(...inputValues);
            break;
          case 'evToEbitda':
            this.result = calculateEVtoEBITDA(...inputValues);
            break;
          case 'evCFO':
            this.result = calculateEVCFO(...inputValues);
            break;
          case 'evFCFF':
            this.result = calculateEVFCFF(...inputValues);
            break;
          default:
            this.result = 'Invalid formula';
            break;
        }
      } catch (error) {
        this.result = "Calculation error: " + error.message;
      }
    },
    validateInput(index) {
      const input = this.formulaInputs[index];
      input.error = isNaN(input.value) || input.value === null || input.value === '';
    },
    checkNumberInput(event) {
      // Allow only number keys, backspace, delete, and navigation keys
      if (
        !(
          event.key >= '0' && event.key <= '9' ||
          event.key === 'Backspace' ||
          event.key === 'Delete' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'Tab' ||
          event.key === '.' // allow decimal point
        )
      ) {
        event.preventDefault();
      }
    },
    async fetchSuggestions() {
      try {
        const response = await axios.get(`/api/search`, {
          params: { query: this.searchQuery },
        });

        // Assuming the response has both stocks and cryptos with a 'category' field
        this.suggestions = response.data || [];

        // Log action for fetching suggestions
        this.logAction('Fetched Suggestions');
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        this.suggestions = [];
        this.logAction('Error Fetching Suggestions');
      }
    },
    selectSuggestion(item) {
      // Check item category to route accordingly
      if (item.category === 'stock') {
        this.$router.push(`/shares/${item.code}`);
      } else if (item.category === 'crypto') {
        this.$router.push(`/crypto/${item.code}`);
      }

      this.suggestions = [];
      this.searchQuery = '';
      this.logAction('Selected Suggestion', item);
    },
    openLogin() {
      this.showLogin = true;
      this.showSignup = false;
      this.logAction('Opened Login Modal');
    },
    openSignup() {
      this.showSignup = true;
      this.showLogin = false;
      this.logAction('Opened Signup Modal');
    },
    closeModal() {
      this.showLogin = false;
      this.showSignup = false;
      this.logAction('Closed Modal');
    },
    toggleProfileMenu() {
      this.showProfileMenu = !this.showProfileMenu;
      this.logAction('Toggled Profile Menu');
    },
    viewProfile() {
      this.$router.push(`/profile/${this.user.username}`);
      this.logAction('Viewing Profile');
    },
    logout() {
      this.isLoggedIn = false;
      this.user = null;
      this.showProfileMenu = false;
      localStorage.removeItem('user');
      this.logAction('User Logged Out');
    },
    handleLogin(user) {
      this.isLoggedIn = true;
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      this.showLogin = false;
      this.logAction('User Logged In');
    },
    handleSignup(user) {
      this.isLoggedIn = true;
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      this.showSignup = false;
      this.logAction('User Signed Up');
    },
    logAction(action, details = {}) {
      const logEntry = {
        action,
        details,
        timestamp: new Date().toISOString(),
        user: this.user ? this.user.email : 'Guest'
      };
      console.log('Log Entry:', logEntry);
    },
    getFormulaHeader(formulaId) {
      const formula = this.formulas.find(f => f.id === formulaId);
      return formula ? formula.name : '';
    },
    getFormulaDescription(formulaId) {
      switch (formulaId) {
        case 'default':
          return '';
        case 'debtEquity':
          return 'The debt-to-equity (D/E) ratio assesses a company\'s financial leverage by dividing its total liabilities by shareholder equity. This crucial metric in corporate finance indicates the extent to which a company relies on debt to fund its operations, as opposed to using its own resources.';
        case 'ltDebtEquity':
          return 'The long-term debt to equity ratio indicates the proportion of a company\'s assets that are funded through long-term financial commitments, such as loans. This ratio is computed by dividing long-term debt by shareholders\' equity.';
        case 'eps':
          return 'Earnings per share (EPS) measures a company\'s profitability by showing the profit earned on each outstanding share of common stock. It is calculated by dividing the company\'s net income by the number of outstanding shares.';
        case 'roa':
          return 'The term "return on assets" (ROA) describes a financial ratio that measures a company\'s profitability relative to its total assets. Corporate management, analysts, and investors use ROA to assess how effectively a company utilizes its assets to produce profit.';
        case 'roe':
          return 'Return on equity (ROE) is a financial performance metric obtained by dividing net income by shareholders\' equity. Since shareholders\' equity equals a company\'s assets minus its debt, ROE is viewed as the return on net assets. ROE serves as an indicator of a corporation\'s profitability and efficiency in generating profits. A higher ROE signifies that the company\'s management is more effective at generating income and growth from its equity financing.';
        case 'roi':
          return 'Return on investment (ROI) is a metric used to assess how efficiently or profitably an investment is performing, or to compare the effectiveness of multiple investments. It aims to quantify the return generated by a specific investment in relation to its cost.';
        case 'currentRatio':
          return 'The current ratio is a liquidity metric that assesses a company’s capacity to meet its short-term liabilities, due within a year. It indicates to investors and analysts how effectively a company can utilize its current assets to cover its current debts and other payables. A current ratio that matches or slightly exceeds the industry average is typically deemed acceptable. A ratio below the industry average may signal a higher risk of financial distress or default. Conversely, a significantly high current ratio compared to peers suggests that the company might not be using its assets efficiently. This ratio is termed "current" because it includes all current assets and liabilities, unlike some other liquidity ratios. It is also known as the working capital ratio.';
        case 'quickRatio':
          return 'The quick ratio is an indicator of a company’s short-term liquidity position and measures a company’s ability to meet its short-term obligations with its most liquid assets. Since it indicates the company’s ability to instantly use its near-cash assets (assets that can be converted quickly to cash) to pay down its current liabilities, it is also called the acid test ratio. An “acid test” is a slang term for a quick test designed to produce instant results.';
        case 'cashRatio':
          return 'The cash ratio is a measurement of a company\'s liquidity. It calculates the ratio of a company\'s total cash and cash equivalents to its current liabilities. The metric evaluates a company\'s ability to repay its short-term debt with cash or near-cash resources such as easily marketable securities. This information is useful to creditors when they decide how much money, if any, they would be willing to loan to a company.';
        case 'nwcPercentageRevenue':
          return 'Net Working Capital (NWC) % Revenue is a financial metric that measures the proportion of a company\'s net working capital relative to its total revenue. Net working capital is calculated as current assets minus current liabilities, and it represents the short-term liquidity and operational efficiency of a company. This ratio provides insights into how effectively a company is managing its working capital in relation to its revenue generation. A higher NWC % Revenue indicates that a larger portion of the company\'s revenue is tied up in working capital, which might affect its ability to invest in growth opportunities. Conversely, a lower ratio suggests more efficient working capital management, allowing more revenue to be available for other purposes such as reinvestment or debt repayment. This metric is particularly useful for investors and financial analysts in assessing a company\'s operational health and its ability to meet short-term obligations.';
        case 'netDebt':
          return 'Net debt is a liquidity metric that\'s used to determine how well a company can pay all its debts if they come due immediately. Net debt shows how much debt a company has on its balance sheet compared to its liquid assets. It shows how much cash would remain if all debts were paid off and if a company has sufficient liquidity to meet its debt obligations.';
        case 'pe':
          return 'The price-to-earnings ratio (P/E) is one of the most widely used metrics for investors and analysts to determine stock valuation. It shows whether a company’s stock price is overvalued or undervalued and can reveal how a stock’s valuation compares with its industry group or a benchmark like the S&P 500 Index. A good P/E for one group or sector could be a poor P/E for another sector, so comparisons should compare similar companies. The P/E ratio helps investors determine the market value of a stock compared with the company’s earnings. It shows what the market is willing to pay for a stock based on its past or future earnings.';
        case 'forwardPE':
          return 'The forward P/E ratio (or forward price-to-earnings ratio) divides the current share price of a company by the estimated future (“forward”) earnings per share (EPS) of that company. For valuation purposes, a forward P/E ratio is typically considered more relevant than a historical P/E ratio.';
        case 'peg':
          return 'The price/earnings to growth ratio (PEG ratio) is a stock\'s price-to-earnings (P/E) ratio divided by the growth rate of its earnings for a specified time period. The PEG ratio is used to determine a stock\'s value while also factoring in the company\'s expected earnings growth, and it is thought to provide a more complete picture than the more standard P/E ratio.';
        case 'ps':
          return 'The price-to-sales (P/S) ratio is a valuation ratio that compares a company’s stock price to its revenues. It is an indicator of the value that financial markets have placed on each dollar of a company’s sales or revenues.';
        case 'pb':
          return 'A company\'s price-to-book ratio is the company\'s current stock price per share divided by its book value per share (BVPS). This shows the market valuation of a company compared to its book value. If your goal as an investor is to unearth high-growth companies selling at low-growth prices, the price-to-book ratio (P/B) offers an effective approach to finding undervalued companies. The P/B ratio can also help investors identify and avoid overvalued companies. However, this ratio has its limitations and there are circumstances where it may not be the most effective metric for valuation.';
        case 'pc':
          return 'The price-to-cash flow (P/CF) ratio is a stock valuation indicator or multiple that measures the value of a stock’s price relative to its operating cash flow per share. The ratio uses operating cash flow (OCF), which adds back non-cash expenses such as depreciation and amortization to net income. P/CF is especially useful for valuing stocks that have positive cash flow but are not profitable because of large non-cash charges.';
        case 'pfcf':
          return 'Price to free cash flow (P/FCF) is an equity valuation metric that compares a company\'s per-share market price to its free cash flow (FCF). This metric is very similar to the valuation metric of price to cash flow but is considered a more exact measure because it uses free cash flow, which subtracts capital expenditures (CAPEX) from a company\'s total operating cash flow, thereby reflecting the actual cash flow available to fund non-asset-related growth. Companies can use this metric to base growth decisions and maintain acceptable free cash flow levels.';
        case 'cape':
          return 'The CAPE ratio is a valuation measure that uses real earnings per share (EPS) over a 10-year period to smooth out fluctuations in corporate profits that occur over different periods of a business cycle. The CAPE ratio, an acronym for cyclically adjusted price-to-earnings ratio, was popularized by Yale University professor Robert Shiller. It is also known as the Shiller P/E ratio. The P/E ratio is a valuation metric that measures a stock’s price relative to the company’s earnings per share. EPS is a company’s profit divided by the outstanding equity shares. The CAPE ratio is generally applied to broad equity indexes to assess whether the market is undervalued or overvalued. While it is a popular and widely followed measure, several leading industry practitioners have called into question its utility as a predictor of future stock market returns.';
        case 'ev':
          return 'Enterprise value (EV) measures a company’s total value, often used as a more comprehensive alternative to market capitalization. EV includes in its calculation not only the market capitalization of a company but also short-term and long-term debt and any cash or cash equivalents on the company’s balance sheet.';
        case 'evToEbitda':
          return 'The EV/EBITDA ratio is a popular metric used as a valuation tool to compare the value of a company, debt included, to the company’s cash earnings less non-cash expenses. It\'s ideal for analysts and investors looking to compare companies within the same industry. The enterprise-value-to-EBITDA ratio is calculated by dividing EV by EBITDA or earnings before interest, taxes, depreciation, and amortization. Typically, EV/EBITDA values below 10 are seen as healthy. However, the comparison of relative values among companies within the same industry is the best way for investors to determine companies with the healthiest EV/EBITDA within a specific sector.';
        case 'evCFO':
          return 'Cash Flow from Operations (CFO) represents the net cash generated from a company’s core business operations, excluding capital expenditures and financing activities. It measures the company\'s ability to generate cash flow from its regular business activities.';
        case 'evFCFF':
          return 'Free Cash Flow to Firm (FCFF) represents the net cash available to the firm after accounting for capital expenditures and operating expenses, before any interest payments are made. It measures the company\'s ability to generate cash flow from its operations that can be used for expansion, debt repayment, or other purposes.';
        default:
          return 'Description not available';
      }
    },
    toggleTheme() {
      this.darkTheme = !this.darkTheme;
      if (this.darkTheme) {
        localStorage.setItem('theme', 'dark');
        document.body.classList.add('dark-theme');
      } else {
        localStorage.setItem('theme', 'light');
        document.body.classList.remove('dark-theme');
      }
    },
    openConsole(event) {
      console.log("Console opened on right-click", event);
    }
  },
  mounted() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkTheme = true;
      document.body.classList.add('dark-theme');
    } else {
      this.darkTheme = false;
      document.body.classList.remove('dark-theme');
    }
  },
};
</script>


<style scoped>
.calculator-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  justify-content: space-between;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background-color: #EBEBEC;
  width: 100%;
  box-sizing: border-box;
}

.logo {
  margin-left: 30px;
  height: 60px;
  max-width: 100%;
}

nav {
  display: flex;
  gap: 30px;
  margin-right: 100px;
  font-size: 22px;
}

nav a {
  color: #383838;
  text-decoration: none;
  padding: 10px 20px;
  border-radius: 5px;
}

nav a:hover {
  background-color: #7c7c7c;
  color: #EBEBEC;
  transition: 0.2s;
}

nav a.active {
  background-color: #383838;
  color: #EBEBEC;
  transition: 0.2s;
}


.user-profile {
  position: relative;
  cursor: pointer;
}

.user-profile img {
  height: 40px;
  width: 40px;
  border-radius: 50%;
}

.profile-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background-color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-radius: 5px;
  overflow: hidden;
  z-index: 1000;
  width: 150px; /* Adjust width to ensure text fits in one line */
}

.profile-menu a {
  display: block;
  padding: 10px 20px; /* Reduced padding to allow more space for text */
  color: #383838;
  text-decoration: none;
  white-space: nowrap; /* Prevents text from wrapping */
}

.profile-menu a:hover {
  background-color: #EBEBEC;
  color: #383838;
}

h2 {
  font-size: 1.7em;
  color: #383838;
}

.content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
  flex-grow: 1;
  color: #383838;
}

.calculator {
  width: 100%;
  margin-top: 30px;
  max-width: 1500px;
  max-height: 1800px;
  padding: 20px;
  box-sizing: border-box;
  background-color: #f4f4f4;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  color: #383838;
}

.formula-selector,
.input-group {
  margin-bottom: 20px;
  font-size: 1.2em;
}

.formula-selector select {
  margin-top: 10px;
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #FBF9FB;
  font-size: 1.0em;
}

.input-group label {
  font-size: 1.2em;
  display: block;
  margin-bottom: 5px;
}

.input-group input {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #383838;
  font-size: 1.0em;
}

button {
  position: relative;
  overflow: hidden;
  width: 100%;
  font-size: 16px;
  padding: 10px;
  background-color: #7c7c7c;
  color: #EBEBEC;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  outline: none;
}

button:hover {
  background-color: #383838;
  color: #EBEBEC;
  transition: 0.2s;
}

h3 {
  margin-top: 20px;
  color: #383838;
}

.formula-header {
  font-weight: bold;
  font-size: 1.7em;
  margin-top: 30px;
  color: #383838;
}

.formula-description {
  margin-top: 20px;
  font-size: 1.4em;
  color: #383838;
}

.error-message {
  color: red;
  font-size: 0.8em;
}

footer {
  width: 100%;
  background-color: #383838;
  color: #EBEBEC;
  padding: 20px;
  box-sizing: border-box;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  flex-wrap: wrap;
}

.footer-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.footer-logo {
  color: #FBF9FB;
  text-decoration: none;
  font-size: 20px;
}

.footer-logo:hover {
  color: #84847C;
}

.footer-social {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.footer-social a {
  color: #FBF9FB;
  text-decoration: none;
}

.footer-social a:hover {
  color: #84847C;
}

.footer-right {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.footer-right a {
  color: #FBF9FB;
  text-decoration: none;
  margin-right: 15px;
}

.footer-right a:hover {
  color: #84847C;
}

.search-container {
  display: flex; /* Використовуємо flex для правильного вирівнювання */
  align-items: center; /* Вирівнюємо по центру вертикально */
  margin-left: -7px;
  flex-grow: 1; /* Дозволяємо контейнеру займати весь доступний простір */
  max-width: 400px; /* Максимальна ширина для кращого вигляду на великих екранах */
  position: relative; /* Позиціювання для suggestions */
}

.search-container input {
  padding: 10px;
  font-size: 16px;
  width: 400px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: #EBEBEC;
  border: 1px solid #ccc;
  border-radius: 5px;
  list-style: none;
  margin: 0;
  padding: 0;
  z-index: 1000;
}

.suggestions li {
  padding: 10px;
  cursor: pointer;
}

.suggestions li:hover {
  background-color: #f0f0f0;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

@media (max-width: 1200px) {
  nav {
    font-size: 20px;
  }
}

@media (max-width: 992px) {
  .content {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 768px) {
  nav {
    gap: 20px;
  }
}

@media (max-width: 576px) {
  header {
    flex-direction: column;
    align-items: center;
  }

  .logo {
    margin-bottom: 10px;
  }

  nav {
    flex-direction: column;
    gap: 10px;
    margin-right: 0;
  }

  .search-container {
    max-width: 100%;
    margin-bottom: 10px;
  }
    .footer-content {
    flex-direction: column;
    align-items: flex-start; /* Align items to the start (left) */
  }
  .footer-right {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start; /* Align items to the start (left) */
  }
}

/* Dark Theme Styles */
.dark-theme {
  background-color: #0d1117;
  color: #BFC3C6;
}

.dark-theme header {
  background-color: #1E2229;
}

.dark-theme nav a {
  color: #BFC3C6;
}

.dark-theme nav a:hover {
  background-color: #8794A0;
  color: #ffffff;
}

.dark-theme nav a.active {
  background-color: #2F4172;
  color: #ffffff;
}

.dark-theme .search-container input {
  background-color: #161b22;
  color: #BFC3C6;
  border-color: #30363d;
}

.dark-theme .content {
  background-color: #0d1117;
}

.dark-theme .calculator {
  background-color: #1E2229;
  box-shadow: 0 4px 8px rgba(255, 255, 255, 0.1); 
  border-radius: 8px;
}

.dark-theme footer {
  background-color: #1E2229;
  color: #BFC3C6;
}
.dark-theme .profile-menu {
  background-color: #161c24;
  color: #BFC3C6;
}

.dark-theme .profile-menu a {
  color: #BFC3C6;
}

.dark-theme .profile-menu a:hover {
  background-color: #8794A0;
  color: #ffffff;
}

.dark-theme .search-container input {
  background-color: #161b22;
  color: #BFC3C6;
  border-color: #30363d;
}

.dark-theme .suggestions {
  background-color: #161b22;
  border-color: #30363d;
}

.dark-theme .suggestions li {
  color: #BFC3C6;
}

.dark-theme .label{
  color: #BFC3C6;
}

.dark-theme .suggestions li:hover {
  background-color: #21262d;
}

.dark-theme .yields-title, .dark-theme .yield-key, .dark-theme .yield-value, .dark-theme .yield-total {
  color: #BFC3C6;
}

.dark-theme .currency-list {
  background-color: #21262d;
  border-color: #30363d;
  color: #BFC3C6;
}

.dark-theme .formula-description {
  margin-top: 20px;
  font-size: 1.4em;
  color: #BFC3C6;
}

.dark-theme .currency-list li:hover {
  background-color: #30363d;
}

.dark-theme .chart-container {
  background-color: #161b22;
  color: #BFC3C6;
}

.dark-theme h3 {
  color: #BFC3C6;
}

.dark-theme .formula-header {
  color: #BFC3C6;
}

.dark-theme .formula-description {
  color: #BFC3C6;
}

.dark-theme .formula-selector,
.input-group {
  margin-bottom: 20px;
  font-size: 1.2em;
}

.dark-theme .formula-selector select {
  color: #161b22;
}

.dark-theme .input-group {
  color: #BFC3C6;
}

.dark-theme .formula-selector {
  color: #BFC3C6;
}

.dark-theme .calculator h2 {
  color: #BFC3C6;
}

.dark-theme p {
  color: #BFC3C6;
}

/* Theme Toggle Styles */
.theme-toggle {
  margin-left: 20px;
  margin-top: 15px;
  position: relative;
  display: inline-block;
  width: 35px;
  height: 14px;
}

.theme-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: -3px;
  bottom: -2px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #7487a4;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.user-profile {
  display: flex;
  align-items: center;
  position: relative;
}

.user-profile img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
}
</style>
