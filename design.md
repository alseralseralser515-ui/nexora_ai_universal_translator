# Multilingual Conversation App - Design Document

## Overview

A production-grade mobile application that enables real-time multilingual conversations with automatic speech recognition, language detection, translation, and text-to-speech synthesis. The app implements a robust finite-state machine for conversation flow and provider-agnostic interfaces for external services.

## Screen List

1. **Home Screen** - Main conversation interface
2. **Conversation History** - View past conversations
3. **Settings** - Configure language preferences and providers
4. **About** - App information and credits

## Primary Content and Functionality

### Home Screen
- **Microphone Button** - Activate speech recognition (primary action)
- **Conversation Display** - Shows current conversation state and messages
- **Language Indicator** - Displays detected and target languages
- **Playback Controls** - Play/pause/stop for text-to-speech output
- **Error Display** - Clear error messages with retry options
- **State Indicator** - Visual feedback for current conversation state (IDLE, LISTENING, RECOGNIZING, TRANSLATING, SPEAKING, etc.)

### Conversation History Screen
- **List of Past Conversations** - Chronological list of conversation sessions
- **Session Details** - Tap to view full conversation transcript
- **Delete Option** - Remove individual conversations or clear all

### Settings Screen
- **Source Language** - Select or auto-detect
- **Target Language** - Choose translation target
- **Provider Configuration** - Select AI and speech providers
- **Audio Settings** - Microphone sensitivity, playback volume
- **Privacy Settings** - Data retention and logging preferences

### About Screen
- **App Version** - Current version number
- **Credits** - Attribution for providers and libraries
- **Legal** - Privacy policy and terms of service links

## Key User Flows

### Primary Conversation Flow
1. User taps microphone button on Home Screen
2. App requests microphone permission (if needed)
3. App enters LISTENING state and displays visual feedback
4. User speaks into microphone
5. App transitions to RECOGNIZING state
6. Speech recognition completes, text appears on screen
7. App detects language and transitions to DETECTING_LANGUAGE state
8. App translates text and transitions to TRANSLATING state
9. App generates speech and transitions to SPEAKING state
10. Text-to-speech plays translated text
11. App returns to IDLE state, ready for next input

### Error Recovery Flow
1. If any step fails (network, permission, provider error), app enters ERROR state
2. User sees clear error message with retry button
3. User can tap retry to restart the flow or tap cancel to return to IDLE
4. App cleans up resources and resets state

### Conversation History Flow
1. User taps History tab
2. App displays list of past conversation sessions
3. User taps a session to view full transcript
4. User can delete individual sessions or return to list

## Color Choices

- **Primary** - `#0a7ea4` (Ocean Blue) - Represents communication and trust
- **Background** - `#ffffff` (Light) / `#151718` (Dark) - Clean, readable surfaces
- **Surface** - `#f5f5f5` (Light) / `#1e2022` (Dark) - Card and container backgrounds
- **Foreground** - `#11181C` (Light) / `#ECEDEE` (Dark) - Primary text
- **Muted** - `#687076` (Light) / `#9BA1A6` (Dark) - Secondary text and hints
- **Success** - `#22C55E` - Positive states and confirmations
- **Warning** - `#F59E0B` - Caution states
- **Error** - `#EF4444` - Error states and alerts

## Interaction Patterns

- **Microphone Button** - Large, prominent, center-screen placement for one-handed use
- **State Transitions** - Animated visual feedback (color changes, scale, opacity)
- **Error Recovery** - Clear, actionable error messages with retry buttons
- **Accessibility** - High contrast, readable text sizes, haptic feedback for confirmations

## Technical Constraints

- Portrait orientation (9:16) for mobile-first design
- One-handed usage - all primary controls within thumb reach
- Follows Apple Human Interface Guidelines (HIG) for iOS-first design
- Responsive to dark mode preferences
- Optimized for network latency and provider failures
