import React from 'react';

// Define the component's props interface for type safety
interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

// A simple, reusable component for a form field with a label.
function FormField({ label, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

export default FormField;
