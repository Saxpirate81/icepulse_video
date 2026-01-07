import { useState, useEffect, useRef } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { useOrg } from '../context/OrgContext'

/**
 * LocationSearch component with autocomplete for rinks/venues
 * Uses saved locations from the database for suggestions
 */
function LocationSearch({ value, onChange, placeholder = "Search for rink or location..." }) {
  const { organization, searchLocations, addLocation } = useOrg()
  const [searchQuery, setSearchQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeoutRef = useRef(null)
  const containerRef = useRef(null)

  // Sync value prop with internal state (only when value changes externally)
  useEffect(() => {
    if (value !== searchQuery) {
      setSearchQuery(value || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery && searchQuery.trim().length >= 1 && organization?.id && searchLocations) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchLocations(searchQuery.trim())
          if (results && results.length > 0) {
            setSuggestions(results.map(loc => ({
              id: loc.id,
              name: loc.name,
              mainText: loc.name,
              secondaryText: loc.city && loc.state ? `${loc.city}, ${loc.state}` : (loc.city || loc.state || '')
            })))
          } else {
            setSuggestions([])
          }
          setShowSuggestions(true)
        } catch (error) {
          console.error('Error searching locations:', error)
          setSuggestions([])
          setShowSuggestions(true)
        }
      }, 200) // Wait 200ms after user stops typing
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, organization?.id, searchLocations])

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setSearchQuery(newValue)
    onChange(newValue) // Always update parent value as user types
  }

  const handleSelectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.name)
    onChange(suggestion.name)
    setShowSuggestions(false)
  }

  const handleInputBlur = () => {
    // When user finishes typing, save the location if it's new and not empty
    if (searchQuery && searchQuery.trim()) {
      onChange(searchQuery.trim())
      // Save location will be handled by the parent component when game is saved
    }
    // Delay closing suggestions to allow clicks on suggestions
    setTimeout(() => {
      setShowSuggestions(false)
    }, 200)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={async () => {
            if (searchQuery.length >= 1 && organization?.id && searchLocations) {
              try {
                const results = await searchLocations(searchQuery.trim())
                if (results && results.length > 0) {
                  setSuggestions(results.map(loc => ({
                    id: loc.id,
                    name: loc.name,
                    mainText: loc.name,
                    secondaryText: loc.city && loc.state ? `${loc.city}, ${loc.state}` : (loc.city || loc.state || '')
                  })))
                } else {
                  setSuggestions([])
                }
                setShowSuggestions(true)
              } catch (error) {
                console.error('Error searching locations:', error)
                setSuggestions([])
                setShowSuggestions(true)
              }
            }
          }}
          onBlur={handleInputBlur}
          className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={placeholder}
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && searchQuery.length >= 1 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-auto">
          {suggestions.length > 0 && (
            <>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-start gap-2"
                >
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{suggestion.mainText}</div>
                    {suggestion.secondaryText && (
                      <div className="text-gray-400 text-sm truncate">{suggestion.secondaryText}</div>
                    )}
                  </div>
                </button>
              ))}
              {/* Manual Entry Option - shown after suggestions */}
              <div className="border-t border-gray-600">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                  onClick={() => {
                    setShowSuggestions(false)
                    // Keep current search query as the value
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-center gap-2 text-blue-400"
                >
                  <Plus className="w-4 h-4" />
                  <span>Don't see the rink? Add the name here...</span>
                </button>
              </div>
            </>
          )}
          
          {/* Show manual entry option if no suggestions found */}
          {suggestions.length === 0 && searchQuery.length >= 1 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
              onClick={() => {
                setShowSuggestions(false)
                // Keep current search query as the value
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-center gap-2 text-blue-400"
            >
              <Plus className="w-4 h-4" />
              <span>Don't see the rink? Add the name here...</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default LocationSearch
