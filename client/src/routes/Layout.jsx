import React from 'react'
import { Outlet } from 'react-router-dom';
import PremiumNavbar from '../components/Navbar';

const Layout = () => {
  return (
    <div className='min-h-screen bg-[#f7f7f5]' >
        <PremiumNavbar/>
        <Outlet />
    </div>
  )
}

export default Layout
