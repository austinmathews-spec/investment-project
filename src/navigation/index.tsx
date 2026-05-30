import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../theme';
import DashboardScreen from '../screens/DashboardScreen';
import AccountsScreen from '../screens/AccountsScreen';
import TrendsScreen from '../screens/TrendsScreen';
import ForecastScreen from '../screens/ForecastScreen';
import GoalsScreen from '../screens/GoalsScreen';

const Tab = createBottomTabNavigator();

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

function getTabIcon(route: string): FeatherIconName {
  switch (route) {
    case 'Dashboard':
      return 'home';
    case 'Accounts':
      return 'credit-card';
    case 'Trends':
      return 'trending-up';
    case 'Forecast':
      return 'bar-chart-2';
    case 'Goals':
      return 'target';
    default:
      return 'circle';
  }
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const iconName = getTabIcon(route.name);
            return <Feather name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.textTertiary,
          tabBarStyle: {
            backgroundColor: Colors.tabBarBackground,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 80,
            paddingBottom: Spacing.md,
            paddingTop: Spacing.sm,
          },
          tabBarLabelStyle: {
            fontSize: FontSizes.xs,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
          },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: FontSizes.lg,
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Accounts" component={AccountsScreen} />
        <Tab.Screen name="Trends" component={TrendsScreen} />
        <Tab.Screen name="Forecast" component={ForecastScreen} />
        <Tab.Screen name="Goals" component={GoalsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
