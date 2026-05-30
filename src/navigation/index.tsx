import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../theme';
import DashboardScreen from '../screens/DashboardScreen';
import AccountsScreen from '../screens/AccountsScreen';
import AccountDetailScreen from '../screens/AccountDetailScreen';
import TrendsScreen from '../screens/TrendsScreen';
import ForecastScreen from '../screens/ForecastScreen';
import GoalsScreen from '../screens/GoalsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const DashboardStack = createNativeStackNavigator();
const AccountsStack = createNativeStackNavigator();

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

function getTabIcon(route: string): FeatherIconName {
  switch (route) {
    case 'DashboardTab':
      return 'home';
    case 'AccountsTab':
      return 'credit-card';
    case 'Trends':
      return 'trending-up';
    case 'Forecast':
      return 'bar-chart-2';
    case 'Goals':
      return 'target';
    case 'Settings':
      return 'settings';
    default:
      return 'circle';
  }
}

const stackScreenOptions = {
  headerStyle: {
    backgroundColor: Colors.background,
  },
  headerTintColor: Colors.textPrimary,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: FontSizes.lg,
  },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
};

function DashboardStackScreen() {
  return (
    <DashboardStack.Navigator screenOptions={stackScreenOptions}>
      <DashboardStack.Screen name="Dashboard" component={DashboardScreen} />
      <DashboardStack.Screen
        name="AccountDetail"
        component={AccountDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.accountName ?? 'Account',
        })}
      />
    </DashboardStack.Navigator>
  );
}

function AccountsStackScreen() {
  return (
    <AccountsStack.Navigator screenOptions={stackScreenOptions}>
      <AccountsStack.Screen name="Accounts" component={AccountsScreen} />
      <AccountsStack.Screen
        name="AccountDetail"
        component={AccountDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.accountName ?? 'Account',
        })}
      />
    </AccountsStack.Navigator>
  );
}

export default function AppNavigator() {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

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
            borderTopWidth: 0.5,
            height: isDesktop ? 56 : 80,
            paddingBottom: isDesktop ? Spacing.sm : Spacing.md,
            paddingTop: Spacing.sm,
          },
          tabBarLabelStyle: {
            fontSize: FontSizes.xs,
            fontWeight: '600',
          },
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="DashboardTab"
          component={DashboardStackScreen}
          options={{ tabBarLabel: 'Dashboard' }}
        />
        <Tab.Screen
          name="AccountsTab"
          component={AccountsStackScreen}
          options={{ tabBarLabel: 'Accounts' }}
        />
        <Tab.Screen name="Trends" component={TrendsScreen} options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', fontSize: FontSizes.lg },
          headerShadowVisible: false,
        }} />
        <Tab.Screen name="Forecast" component={ForecastScreen} options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', fontSize: FontSizes.lg },
          headerShadowVisible: false,
        }} />
        <Tab.Screen name="Goals" component={GoalsScreen} options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', fontSize: FontSizes.lg },
          headerShadowVisible: false,
        }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', fontSize: FontSizes.lg },
          headerShadowVisible: false,
        }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
