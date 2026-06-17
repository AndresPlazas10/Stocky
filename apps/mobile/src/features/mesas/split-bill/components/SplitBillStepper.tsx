import { Text, View } from 'react-native';
import { splitBillStyles as styles } from '../splitBillStyles';

interface SplitBillStepperProps {
  currentStep: 1 | 2;
}

export function SplitBillStepper({ currentStep }: SplitBillStepperProps) {
  return (
    <View style={styles.stepperRow}>
      {[
        { id: 1 as const, label: 'Cuentas' },
        { id: 2 as const, label: 'División' },
      ].map((step) => {
        const active = currentStep === step.id;
        const complete = currentStep > step.id;
        return (
          <View key={step.id} style={styles.stepperItem}>
            <View
              style={[
                styles.stepperDot,
                active && styles.stepperDotActive,
                complete && styles.stepperDotComplete,
              ]}
            >
              <Text
                style={[styles.stepperDotText, (active || complete) && styles.stepperDotTextActive]}
              >
                {step.id}
              </Text>
            </View>
            <Text style={[styles.stepperLabel, active && styles.stepperLabelActive]}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
