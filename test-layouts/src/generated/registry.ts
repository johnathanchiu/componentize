import Logo from './Logo';
import NavLinks from './NavLinks';
import SignupBtn from './SignupBtn';
import HeroHeadline from './HeroHeadline';
import HeroSubtext from './HeroSubtext';
import HeroButtons from './HeroButtons';
import FeatureCard1 from './FeatureCard1';
import FeatureCard2 from './FeatureCard2';
import FeatureCard3 from './FeatureCard3';
import PricingFree from './PricingFree';
import PricingPro from './PricingPro';
import PricingEnterprise from './PricingEnterprise';
import Footer from './Footer';
// Dashboard components
import DashboardHeader from './DashboardHeader';
import StatCardRevenue from './StatCardRevenue';
import StatCardUsers from './StatCardUsers';
import StatCardOrders from './StatCardOrders';
import StatCardGrowth from './StatCardGrowth';
import ChartPlaceholder from './ChartPlaceholder';
import ActivityFeed from './ActivityFeed';
// E-commerce components
import ProductImage from './ProductImage';
import ProductDetails from './ProductDetails';
import ReviewsSection from './ReviewsSection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const componentRegistry: Record<string, React.ComponentType<any>> = {
  // Landing page components
  Logo,
  NavLinks,
  SignupBtn,
  HeroHeadline,
  HeroSubtext,
  HeroButtons,
  FeatureCard1,
  FeatureCard2,
  FeatureCard3,
  PricingFree,
  PricingPro,
  PricingEnterprise,
  Footer,
  // Dashboard components
  DashboardHeader,
  StatCardRevenue,
  StatCardUsers,
  StatCardOrders,
  StatCardGrowth,
  ChartPlaceholder,
  ActivityFeed,
  // E-commerce components
  ProductImage,
  ProductDetails,
  ReviewsSection,
};
