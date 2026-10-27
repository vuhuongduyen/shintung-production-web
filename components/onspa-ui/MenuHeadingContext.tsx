"use client";
import {createContext} from 'react';
// Only tabbed workspace roots opt in; home, reports and dialogs retain headings.
export const MenuHeadingContext=createContext(false);
