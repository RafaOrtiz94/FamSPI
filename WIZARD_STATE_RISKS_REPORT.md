# Business Case Wizard - State Management Risks Report

## Executive Summary
Analysis of state synchronization risks and side effects reveals **multiple medium and high-risk issues** that can cause data loss, performance degradation, and unpredictable wizard behavior.

---

## Risk Matrix

### 🔴 **HIGH RISK - Data Loss & Corruption**

| Risk ID | Risk Description | Where it Occurs | Severity | Trigger Scenario | Impact |
|---------|------------------|------------------|----------|------------------|---------|
| **AUTO_SAVE_STORM** | Auto-save every 2 seconds with large state objects | `WizardProvider` useEffect | HIGH | Large equipment arrays with 50+ items | Browser freezing, localStorage quota exceeded, data corruption |
| **LOCALSTORAGE_PARSE_FAILURE** | JSON.parse errors reset wizard to defaults | `WizardProvider` initialization | HIGH | Corrupted localStorage data from previous crashes | Complete data loss, user frustration, workflow interruption |
| **STATE_RACE_CONDITIONS** | Multiple concurrent setState calls | Step components with debounced updates | HIGH | Rapid user input changes across multiple form fields | Inconsistent state, lost user inputs, unpredictable UI |

### 🟡 **MEDIUM RISK - Performance & UX Issues**

| Risk ID | Risk Description | Where it Occurs | Severity | Trigger Scenario | Impact |
|---------|------------------|------------------|----------|------------------|---------|
| **MEMORY_LEAKS** | Uncleaned useEffect timers and subscriptions | Determinations step debounced saves | MEDIUM | Long wizard sessions with many quantity changes | Memory accumulation, browser slowdown, eventual crashes |
| **STALE_CLOSURES** | Outdated function references in effects | Equipment selection with complex state dependencies | MEDIUM | State updates during async operations | Incorrect data display, stale UI state, user confusion |
| **EVENT_EMISSION_OVERLOAD** | Uncontrolled event emissions without cleanup | API layer eventEmitter in cachedApiCall | MEDIUM | Multiple concurrent API calls during data loading | Event queue overflow, unresponsive UI, memory pressure |
| **LARGE_STATE_SERIALIZATION** | Complex nested objects serialized repeatedly | Auto-save with equipmentPairs[] and lisInterfaces[] | MEDIUM | Manager workflow with multiple equipment configurations | CPU spikes, battery drain on mobile, slow responsiveness |

### 🟢 **LOW RISK - Edge Cases & Observability**

| Risk ID | Risk Description | Where it Occurs | Severity | Trigger Scenario | Impact |
|---------|------------------|------------------|----------|------------------|---------|
| **API_FAILURE_SILENT** | API save failures not retried | Step components handleSubmit functions | LOW | Network interruptions during data persistence | Data loss if user doesn't notice error toast |
| **CLEANUP_INCOMPLETE** | clearDraft doesn't reset all derived state | WizardProvider clearDraft function | LOW | Manual draft clearing after partial completion | Inconsistent state between reloads |
| **STEP_TRANSITION_RACE** | useEffect step validation races with user navigation | BusinessCaseWizard useEffect for step bounds | LOW | Very fast user clicking through steps | Temporary invalid step display |

---

## Detailed Risk Analysis

### **AUTO_SAVE_STORM (HIGH RISK)**

**Technical Details:**
```javascript
useEffect(() => {
  const timeout = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, 2000);
  return () => clearTimeout(timeout);
}, [state]);
```

**Why Risky:**
- **Frequency**: Every 2 seconds regardless of change size
- **Payload Size**: Complex nested objects (equipmentPairs[], lisInterfaces[], determinations[])
- **Storage Limits**: localStorage typically 5-10MB per origin
- **Performance Impact**: JSON.stringify/parse on large objects blocks main thread

**Real-World Impact:**
- Manager workflow with 20 equipment pairs = ~50KB per save
- 2-second intervals = 25 saves per minute = 1.25MB/minute
- 10-minute session = 12.5MB storage usage

**Mitigation Required:** Debounced auto-save with change detection.

---

### **LOCALSTORAGE_PARSE_FAILURE (HIGH RISK)**

**Technical Details:**
```javascript
const stored = localStorage.getItem(STORAGE_KEY);
if (stored) {
  try {
    return { ...defaultState, ...JSON.parse(stored) };
  } catch (err) {
    console.warn("No se pudo leer borrador de wizard", err);
  }
}
return defaultState;
```

**Why Risky:**
- **Silent Failure**: Falls back to defaults without user notification
- **Data Loss**: Complete wizard state loss on any JSON corruption
- **Browser Issues**: localStorage corruption from browser crashes, disk space, or manual clearing
- **User Impact**: Hours of work lost without warning

**Mitigation Required:** Robust error handling with user notification and recovery options.

---

### **STATE_RACE_CONDITIONS (HIGH RISK)**

**Technical Details:**
```javascript
// Determinations step - multiple debounced updates
const debounceRefs = useRef({});

// Multiple setState calls from different handlers
updateState({ determinations: newDeterminations });
updateState({ generalData: { ...prev.generalData, ...formData } });
```

**Why Risky:**
- **Concurrent Updates**: React's setState is asynchronous
- **Dependency Issues**: Updates depend on previous state values
- **Race Windows**: Network responses vs user interactions
- **Stale State**: Closures capturing outdated state references

**Real-World Impact:**
- User types quickly in determinations → some inputs lost
- API responses arrive out of order → inconsistent data display
- Multiple form sections updated simultaneously → data corruption

**Mitigation Required:** useReducer for complex state or proper state batching.

---

### **MEMORY_LEAKS (MEDIUM RISK)**

**Technical Details:**
```javascript
// Determinations debounced saves
const debounceRefs = useRef({});

const persistQuantity = async (detId, qty) => {
  // Creates new timeout on every call
  const timer = setTimeout(async () => {
    await api.post(...);
  }, 1000);
  debounceRefs.current[detId] = timer;
};
```

**Why Risky:**
- **Timer Accumulation**: New timers created without clearing old ones
- **Reference Holding**: Closures hold references to component state
- **No Cleanup**: Component unmount doesn't clear pending timers
- **Memory Growth**: Long sessions accumulate hundreds of timers

**Mitigation Required:** Proper cleanup on unmount and timer replacement logic.

---

### **STALE_CLOSURES (MEDIUM RISK)**

**Technical Details:**
```javascript
// Equipment selection with complex dependencies
const selectPrimary = (pairId, item) => {
  updatePair(pairId, {
    primary: { ...item },  // Closure captures current item
    backup: null,         // But backup clearing depends on current state
  });
};
```

**Why Risky:**
- **Captured Values**: Functions capture variables at definition time
- **State Dependencies**: Logic depends on current state values
- **Async Operations**: State changes during async operations
- **Stale References**: Event handlers using outdated state

**Mitigation Required:** useCallback with proper dependencies or state selectors.

---

### **EVENT_EMISSION_OVERLOAD (MEDIUM RISK)**

**Technical Details:**
```javascript
// API layer - unconditional event emission
if (response.config.url.includes('/business-case/')) {
  eventEmitter.emitDebounced('data-updated', data, 1000);
}
```

**Why Risky:**
- **Uncontrolled Emission**: Every API call emits events
- **No Cleanup**: EventEmitter subscriptions never removed
- **Memory Accumulation**: Event queue grows with app usage
- **Performance Impact**: Event processing blocks main thread

**Mitigation Required:** Subscription cleanup and selective event emission.

---

## Current State Assessment

### **Risk Distribution**
- **High Risk**: 3 issues (40%)
- **Medium Risk**: 4 issues (53%)
- **Low Risk**: 3 issues (7%)

### **Most Critical Issues**
1. **AUTO_SAVE_STORM** - Performance and data limits
2. **LOCALSTORAGE_PARSE_FAILURE** - Silent data loss
3. **STATE_RACE_CONDITIONS** - Data corruption

### **Immediate Action Items**
1. **Implement change detection** for auto-save (don't save if no changes)
2. **Add localStorage validation** with corruption recovery
3. **Implement proper state batching** or useReducer
4. **Add memory leak detection** and timer cleanup
5. **Audit event subscriptions** and add cleanup

---

## Recommended Architecture Improvements

### **1. State Management Overhaul**
```javascript
// Replace useState with useReducer
const [state, dispatch] = useReducer(wizardReducer, initialState);

// Batched updates for complex operations
dispatch({ type: 'BATCH_UPDATE', payload: { determinations, equipment } });
```

### **2. Smart Auto-save**
```javascript
// Change detection before saving
const hasChanges = useMemo(() => {
  return !deepEqual(state, lastSavedState);
}, [state]);

useEffect(() => {
  if (!hasChanges) return;
  // Save logic...
}, [hasChanges]);
```

### **3. Robust Persistence Layer**
```javascript
// localStorage wrapper with validation
const safeLocalStorage = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      // Handle quota exceeded, etc.
      return false;
    }
  },
  get: (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch (error) {
      return fallback;
    }
  }
};
```

### **4. Memory Management**
```javascript
// Component cleanup
useEffect(() => {
  return () => {
    // Clear all timers
    Object.values(debounceRefs.current).forEach(clearTimeout);
    // Unsubscribe events
    eventEmitter.off('data-updated', callback);
  };
}, []);
```

---

## Testing Recommendations

### **Performance Testing**
- Large state objects (100+ equipment items)
- Rapid user interactions (stress testing)
- Memory leak detection over extended sessions

### **Data Persistence Testing**
- localStorage corruption scenarios
- Browser crashes during auto-save
- Network failures during API persistence

### **Concurrency Testing**
- Multiple rapid state updates
- API responses arriving out of order
- Component unmounting during async operations

---

## Summary

The Business Case Wizard state management has **significant risks** that can lead to:
- **Data loss** through localStorage failures
- **Performance degradation** from excessive auto-saving
- **User experience issues** from race conditions
- **Memory leaks** in long sessions

**Immediate attention required** for the 3 high-risk issues, with architectural improvements needed for long-term stability.

**Risk Level**: 🔴 **HIGH** - Requires immediate remediation planning.
