import React from 'react';

// Define the component's props interface
interface CalculatorTemplateProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

// The main layout wrapper for each calculator page.
function CalculatorTemplate({ title, description, children }: CalculatorTemplateProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-gray-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default CalculatorTemplate;
