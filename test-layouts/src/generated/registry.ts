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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const componentRegistry: Record<string, React.ComponentType<any>> = {
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
};
