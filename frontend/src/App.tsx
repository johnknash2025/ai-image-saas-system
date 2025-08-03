import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, CssBaseline, AppBar, Toolbar, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ImageIcon from '@mui/icons-material/Image';
import TwitterIcon from '@mui/icons-material/Twitter';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SettingsIcon from '@mui/icons-material/Settings';
import LockIcon from '@mui/icons-material/Lock';

import DashboardPage from './pages/DashboardPage';
import ImagesPage from './pages/ImagesPage';
import TwitterPage from './pages/TwitterPage';
import SaaSPage from './pages/SaaSPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';

const drawerWidth = 240;

const App: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Images', icon: <ImageIcon />, path: '/images' },
    { text: 'Twitter', icon: <TwitterIcon />, path: '/twitter' },
    { text: 'SaaS', icon: <StorefrontIcon />, path: '/saas' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    { text: 'Login', icon: <LockIcon />, path: '/login' },
  ];

  const drawer = (
    <div>
      <Toolbar />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding component={Link} to={item.path} sx={{ color: 'inherit', textDecoration: 'none' }}>
            <ListItemButton selected={location.pathname === item.path}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            AI Image SaaS Dashboard
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        {drawer}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/twitter" element={<TwitterPage />} />
          <Route path="/saas" element={<SaaSPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default App;