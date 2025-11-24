import React from 'react';

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingTier {
  name: string;
  price: number;
  period: string;
  description: string;
  features: PricingFeature[];
  highlighted?: boolean;
  buttonText: string;
  badge?: string;
}

interface PricingCardProps {
  tier?: PricingTier;
  onSelect?: (tierName: string) => void;
}

const defaultTiers: PricingTier[] = [
  {
    name: 'Starter',
    price: 9,
    period: 'month',
    description: 'Perfect for individuals and small projects',
    buttonText: 'Get Started',
    features: [
      { text: '5 Projects', included: true },
      { text: '10 GB Storage', included: true },
      { text: 'Basic Support', included: true },
      { text: 'Analytics Dashboard', included: true },
      { text: 'Custom Domain', included: false },
      { text: 'Advanced Security', included: false },
      { text: 'Priority Support', included: false },
    ],
  },
  {
    name: 'Professional',
    price: 29,
    period: 'month',
    description: 'Ideal for growing teams and businesses',
    buttonText: 'Start Free Trial',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      { text: 'Unlimited Projects', included: true },
      { text: '100 GB Storage', included: true },
      { text: 'Priority Support', included: true },
      { text: 'Analytics Dashboard', included: true },
      { text: 'Custom Domain', included: true },
      { text: 'Advanced Security', included: true },
      { text: 'API Access', included: false },
    ],
  },
  {
    name: 'Enterprise',
    price: 99,
    period: 'month',
    description: 'Advanced features for large organizations',
    buttonText: 'Contact Sales',
    features: [
      { text: 'Unlimited Everything', included: true },
      { text: 'Unlimited Storage', included: true },
      { text: '24/7 Dedicated Support', included: true },
      { text: 'Advanced Analytics', included: true },
      { text: 'Custom Domain', included: true },
      { text: 'Advanced Security', included: true },
      { text: 'Full API Access', included: true },
    ],
  },
];

interface SingleCardProps {
  tier: PricingTier;
  onSelect: (tierName: string) => void;
  isSelected: boolean;
}

const SingleCard: React.FC<SingleCardProps> = ({ tier, onSelect, isSelected }) => {
  const { name, price, period, description, features, highlighted, buttonText, badge } = tier;

  return (
    <div
      className={`relative bg-white rounded-2xl shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
        highlighted ? 'ring-2 ring-indigo-600 scale-105 lg:scale-110' : 'ring-1 ring-gray-200'
      } ${isSelected ? 'ring-2 ring-green-500' : ''}`}
    >
      {/* Badge */}
      {badge && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md">
            {badge}
          </span>
        </div>
      )}

      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline">
            <span className="text-5xl font-extrabold text-gray-900">${price}</span>
            <span className="text-gray-600 ml-2">/ {period}</span>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => onSelect(name)}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-center transition-all duration-200 mb-8 ${
            highlighted
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          } ${isSelected ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
          aria-label={`Select ${name} plan`}
        >
          {isSelected ? '✓ Selected' : buttonText}
        </button>

        {/* Features List */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            What's included:
          </p>
          <ul className="space-y-3">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start">
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mr-3 mt-0.5 ${
                    feature.included
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {feature.included ? (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={`text-sm ${
                    feature.included ? 'text-gray-700' : 'text-gray-400 line-through'
                  }`}
                >
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const PricingCard: React.FC<PricingCardProps> = ({ tier, onSelect }) => {
  const [selectedTier, setSelectedTier] = React.useState<string | null>(null);

  const handleSelect = React.useCallback(
    (tierName: string) => {
      setSelectedTier(tierName);
      if (onSelect) {
        onSelect(tierName);
      }
    },
    [onSelect]
  );

  // If a single tier is provided, render just that card
  if (tier) {
    return (
      <div className="w-full max-w-sm mx-auto">
        <SingleCard tier={tier} onSelect={handleSelect} isSelected={selectedTier === tier.name} />
      </div>
    );
  }

  // Otherwise, render all three tiers
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Select the perfect plan for your needs. All plans include a 14-day money-back guarantee.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-6">
          {defaultTiers.map((tierItem) => (
            <SingleCard
              key={tierItem.name}
              tier={tierItem}
              onSelect={handleSelect}
              isSelected={selectedTier === tierItem.name}
            />
          ))}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <p className="text-gray-600">
            All plans include SSL certificate, daily backups, and 99.9% uptime guarantee
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingCard;