import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Reusable Dropdown component for single-select or multi-select
 * @param {Object} props
 * @param {Array} props.options - Array of {value, label} objects
 * @param {string|Array} props.value - Selected value(s). String for single-select, Array for multi-select
 * @param {Function} props.onChange - Callback when selection changes. Receives (value) where value is string or array
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.multiple - Whether to allow multiple selections
 * @param {boolean} props.showAllOption - Whether to show "All" option (default: true for multi-select, false for single-select)
 * @param {string} props.allOptionLabel - Label for "All" option (default: "All")
 * @param {boolean} props.disabled - Whether dropdown is disabled
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.icon - Optional icon to display before the dropdown
 */
function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  multiple = false,
  showAllOption = null, // null means auto-detect based on multiple
  allOptionLabel = 'All',
  disabled = false,
  className = '',
  icon = null,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Auto-detect showAllOption if not explicitly set
  const shouldShowAll = showAllOption !== null ? showAllOption : multiple

  // Determine selected values
  const selectedValues = multiple
    ? Array.isArray(value) ? value : []
    : value ? [value] : []

  // Sort options: selected items first (for multi-select), then alphabetical
  // For single-select, just sort alphabetically
  const sortedOptions = multiple && selectedValues.length > 0
    ? [
        // Selected items first (in the order they appear in selectedValues to maintain selection order)
        ...selectedValues
          .map(val => options.find(opt => opt.value === val))
          .filter(Boolean), // Remove any undefined values
        // Then unselected items, sorted alphabetically
        ...options
          .filter(opt => !selectedValues.includes(opt.value))
          .sort((a, b) => {
            const labelA = (a.label || String(a.value)).toLowerCase()
            const labelB = (b.label || String(b.value)).toLowerCase()
            return labelA.localeCompare(labelB)
          })
      ]
    : // For single-select or no selections, just sort alphabetically
      [...options].sort((a, b) => {
        const labelA = (a.label || String(a.value)).toLowerCase()
        const labelB = (b.label || String(b.value)).toLowerCase()
        return labelA.localeCompare(labelB)
      })

  // Check if "All" is selected (only for multi-select)
  // "All" is selected ONLY when:
  // 1. We're in multi-select mode with "All" option enabled
  // 2. We have options available (at least 2 options, otherwise "All" doesn't make sense)
  // 3. The number of selected items EXACTLY equals the number of options (no more, no less)
  // 4. Every single option is actually in the selected array
  // 5. There are no duplicate selections
  // 6. All selected values are valid options
  // This ensures "All" is only checked when TRULY ALL items are selected, not just multiple items
  const isAllSelected = multiple && shouldShowAll && 
    options.length > 1 && // Need at least 2 options for "All" to make sense
    selectedValues.length > 0 && 
    selectedValues.length === options.length && // EXACT match - not more, not less
    selectedValues.length === new Set(selectedValues).size && // No duplicates
    options.every(opt => selectedValues.includes(opt.value)) && // Every option is selected
    selectedValues.every(val => options.some(opt => opt.value === val)) && // All selected values are valid
    // Double-check: ensure we have exactly the right number and they match
    new Set(selectedValues).size === options.length &&
    new Set(options.map(opt => opt.value)).size === options.length // Options are unique

  // Get display text
  const getDisplayText = () => {
    if (multiple) {
      if (isAllSelected) {
        return allOptionLabel
      }
      if (selectedValues.length === 0) {
        return placeholder
      }
      if (selectedValues.length === 1) {
        const option = options.find(opt => opt.value === selectedValues[0])
        return option?.label || selectedValues[0]
      }
      return `${selectedValues.length} selected`
    } else {
      if (!value) {
        return placeholder
      }
      const option = options.find(opt => opt.value === value)
      return option?.label || value
    }
  }

  // Handle option click
  const handleOptionClick = (optionValue, event) => {
    // Prevent event propagation to avoid double-clicks
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    if (multiple) {
      // Get current selected values from props (most up-to-date)
      const currentSelected = Array.isArray(value) ? [...value] : []
      
      // Check if "All" is currently selected - must match EXACTLY
      // This check must be identical to the isAllSelected check above
      const allCurrentlySelected = shouldShowAll && 
        options.length > 1 && // Need at least 2 options
        currentSelected.length > 0 && 
        currentSelected.length === options.length && // EXACT match
        currentSelected.length === new Set(currentSelected).size && // No duplicates
        options.every(opt => currentSelected.includes(opt.value)) && // Every option is selected
        currentSelected.every(val => options.some(opt => opt.value === val)) // All selected are valid
      
      let newValues = []
      
      // Handle "All" option click
      if (shouldShowAll && optionValue === '__all__') {
        if (allCurrentlySelected) {
          // "All" is checked - uncheck it by clearing all selections
          newValues = []
        } else {
          // "All" is not checked - check it by selecting all options
          newValues = options.map(opt => opt.value)
        }
      } 
      // Handle individual option click (NOT "All")
      else {
        // CRITICAL RULE: When clicking an individual item, NEVER select all items
        // Only the clicked item should be toggled
        
        // Determine if the clicked item is currently selected
        const isCurrentlySelected = currentSelected.includes(optionValue)
        
        // If "All" is currently selected OR if currentSelected has all items,
        // clicking any individual item should start fresh with ONLY that item
        const hasAllItems = currentSelected.length === options.length && options.length > 0
        
        if (allCurrentlySelected || hasAllItems) {
          // User clicked an individual item when "All" was selected (or all items are selected)
          // Start completely fresh with ONLY this one item
          // If they want to deselect, make it empty; if they want to select, make it just this item
          if (isCurrentlySelected && hasAllItems) {
            // They're clicking to deselect from "All" - start with just this item deselected
            // Actually, if "All" is selected and they click an item, they probably want to deselect all and select just this one
            // So we'll select just this one
            newValues = [optionValue]
          } else {
            // Select only this item
            newValues = [optionValue]
          }
        } 
        // Normal individual item toggle (when "All" is NOT selected and not all items are selected)
        else {
          // Simply toggle this one item - add if not selected, remove if selected
          if (isCurrentlySelected) {
            // Item is already selected - remove ONLY this item
            newValues = currentSelected.filter(val => val !== optionValue)
          } else {
            // Item is not selected - add ONLY this item to the selection
            // Start with current selection (filtered to valid options) and add just this one
            const validCurrent = currentSelected.filter(val => 
              options.some(opt => opt.value === val)
            )
            newValues = [...validCurrent, optionValue]
            
            // If adding this item results in all items being selected, that's OK!
            // This is the natural behavior when selecting the last unselected item.
            // We only want to prevent the bug where clicking one item somehow selects all
            // when it shouldn't (e.g., when currentSelected was empty or had few items).
            // So we allow it if the previous selection was close to all items (n-1 items).
            const wasAlmostAllSelected = validCurrent.length === options.length - 1
            if (newValues.length === options.length && !wasAlmostAllSelected && options.length > 1) {
              // This is suspicious - we went from not-close-to-all to all items with one click
              // This shouldn't happen unless there's a bug
              console.error('Dropdown BUG: Individual click resulted in all items when it shouldn\'t. Forcing single selection.')
              newValues = [optionValue]
            }
            // Otherwise, if we legitimately selected all items (by clicking the last one), that's fine
          }
        }
      }
      
      // Clean up: remove duplicates and invalid values
      newValues = [...new Set(newValues)].filter(val => 
        options.some(opt => opt.value === val)
      )
      
      // Final safety check: Ensure the clicked item is in the selection when adding (not when removing)
      if (multiple && shouldShowAll && optionValue !== '__all__') {
        const wasSelected = Array.isArray(value) ? value.includes(optionValue) : false
        if (!wasSelected && !newValues.includes(optionValue)) {
          // We were trying to add it but it's not there - add it
          console.warn('Dropdown: Clicked item not in selection after update. Adding it.')
          newValues = [...newValues, optionValue]
        }
      }
      
      // Final validation: Ensure newValues is an array
      if (!Array.isArray(newValues)) {
        console.error('Dropdown BUG: newValues is not an array. Resetting.')
        newValues = optionValue === '__all__' ? [] : [optionValue]
      }
      
      // Call onChange with the new values
      // Use a small delay to ensure state updates are processed correctly
      onChange(newValues)
    } else {
      // Single select mode
      onChange(optionValue)
      setIsOpen(false)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2
          bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors hover:bg-gray-600
          ${icon ? 'pl-3' : ''}
        `}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span className="truncate text-left">{getDisplayText()}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-auto">
          {shouldShowAll && multiple && (
            <button
              type="button"
              onClick={(e) => handleOptionClick('__all__', e)}
              className={`
                w-full text-left px-4 py-2 flex items-center gap-2
                hover:bg-gray-600 transition-colors
                ${isAllSelected ? 'bg-gray-600' : ''}
              `}
            >
              {/* Only show checkmark if ALL options are selected, not just multiple */}
              {isAllSelected && selectedValues.length === options.length && options.length > 0 && (
                <Check className="w-4 h-4 text-blue-400" />
              )}
              <span className={isAllSelected ? 'text-blue-400 font-semibold' : ''}>
                {allOptionLabel}
              </span>
            </button>
          )}
          
          {sortedOptions.map((option) => {
            const isSelected = multiple
              ? selectedValues.includes(option.value)
              : value === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={(e) => handleOptionClick(option.value, e)}
                className={`
                  w-full text-left px-4 py-2 flex items-center gap-2
                  hover:bg-gray-600 transition-colors
                  ${isSelected ? 'bg-gray-600' : ''}
                `}
              >
                {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                <span className={isSelected ? 'text-blue-400 font-semibold' : ''}>
                  {option.label || option.value}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Dropdown
