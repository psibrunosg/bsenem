// src/components/index.js - Main exports

// Layout components
export { AppShell } from './AppShell.js';
export { Sidebar } from './Sidebar.js';
export { Header } from './Header.js';
export { MiniPlayer } from './MiniPlayer.js';
export { VideoPlayer } from './VideoPlayer.js';
export { AudioPlayer } from './AudioPlayer.js';
export { Playlist } from './Playlist.js';

// Form components
export { Button, ButtonGroup, createIconButton } from './Button.js';
export { Input, Textarea, Label } from './Input.js';
export { Select } from './Select.js';
export { Checkbox, CheckboxGroup } from './Checkbox.js';
export { Radio, RadioGroup } from './Radio.js';
export { Switch } from './Switch.js';
export { Slider } from './Slider.js';

// Feedback components
export { Modal, alertModal, confirmModal, promptModal } from './Modal.js';
export { Toast } from './Toast.js';
export { Tooltip, initTooltips, destroyTooltips } from './Tooltip.js';
export { Alert, InlineAlert, AlertBanner } from './Alert.js';

// Navigation components
export { Tabs } from './Tabs.js';
export { Dropdown } from './Dropdown.js';

// Data display components
export { Avatar, AvatarGroup } from './Avatar.js';
export { Badge, BadgeGroup } from './Badge.js';
export { Progress, CircularProgress, StepProgress } from './Progress.js';

// Utility components
export { Skeleton, SkeletonLayouts } from './Skeleton.js';

// Component registry for dynamic imports
export const componentRegistry = {
  // Layout
  AppShell,
  Sidebar,
  Header,
  MiniPlayer,
  VideoPlayer,
  AudioPlayer,
  Playlist,
  
  // Form
  Button,
  ButtonGroup,
  Input,
  Textarea,
  Label,
  Select,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  
  // Feedback
  Modal,
  Toast,
  Tooltip,
  Alert,
  InlineAlert,
  AlertBanner,
  
  // Navigation
  Tabs,
  Dropdown,
  
  // Data Display
  Avatar,
  AvatarGroup,
  Badge,
  BadgeGroup,
  Progress,
  CircularProgress,
  StepProgress,
  
  // Utility
  Skeleton
};

// Helper to create component by name
export function createComponent(name, options = {}) {
  const Component = componentRegistry[name];
  if (!Component) {
    throw new Error(`Component "${name}" not found in registry`);
  }
  return new Component(options);
}

// Helper to render component by name directly to DOM
export function renderComponent(name, container, options = {}) {
  const component = createComponent(name, options);
  const element = component.render();
  if (container) {
    container.appendChild(element);
  }
  return { component, element };
}