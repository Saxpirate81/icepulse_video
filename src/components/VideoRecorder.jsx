import { useState, useRef, useEffect } from 'react'
import { Video, Square, AlertCircle, RefreshCw, HelpCircle, X, Mic, MicOff, Camera, Calendar, Sparkles, Dumbbell, Copy, Share2, Check, RotateCcw } from 'lucide-react'
import Dropdown from './Dropdown'
import { useAuth } from '../context/AuthContext'
import { useOrgOptional } from '../context/OrgContext'
import { useIndividual } from '../context/IndividualContext'
import { supabase } from '../lib/supabase'

function VideoRecorder() {
  const orgContext = useOrgOptional()
  const organization = orgContext?.organization || null
  const isOrganizationLoading = orgContext?.isLoading !== false
  const { user } = useAuth()
  
  // Try to get IndividualContext for players/parents (may not be available)
  let individualContext = null
  try {
    individualContext = useIndividual()
  } catch (e) {
    // IndividualContext not available - that's okay
  }
  
  const addVideoRecording = orgContext?.addVideoRecording || null
  const addGame = orgContext?.addGame || null
  const uploadVideoToStorage = orgContext?.uploadVideoToStorage || null
  const uploadThumbnailToStorage = orgContext?.uploadThumbnailToStorage || null
  const createStream = orgContext?.createStream || null
  const uploadStreamChunk = orgContext?.uploadStreamChunk || null
  const queueStreamChunkUpload = orgContext?.queueStreamChunkUpload || null // Get queue function
  const stopStream = orgContext?.stopStream || null
  const reactivateStream = orgContext?.reactivateStream || null
  const getRecentlyStoppedStream = orgContext?.getRecentlyStoppedStream || null
  const checkStreamingPermission = orgContext?.checkStreamingPermission || null
  
  // For players: get teams/seasons from their assignments
  const [playerTeams, setPlayerTeams] = useState([])
  const [playerSeasons, setPlayerSeasons] = useState([])
  
  // Add timeout helper with shorter timeout
  const withShortTimeout = (promise, timeoutMs = 5000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ])
  }

  useEffect(() => {
    let isMounted = true // Prevent state updates if component unmounts
    let abortController = new AbortController()
    
    const loadPlayerTeamsAndSeasons = async () => {
      // Only load if user is on the recorder view and is a player/parent
      // Add a delay to prevent immediate loading on mount
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (abortController.signal.aborted || !isMounted) return
      
      // Load teams/seasons for players OR parents (through their connected players)
      if ((user?.role === 'player' || user?.role === 'parent') && user?.id) {
        console.log(`🎮 Loading teams/seasons for ${user.role}:`, user.id)
        try {
          let playerIds = []
          
          if (user.role === 'player') {
            // For players: get their own player record with timeout
            const { data: playerData, error: playerError } = await withShortTimeout(
              supabase
                .from('icepulse_players')
                .select('id')
                .or(`profile_id.eq.${user.id},individual_user_id.eq.${user.id}`)
                .limit(10),
              5000
            ).catch(err => {
              console.error('🎮 Player query timeout:', err)
              return { data: null, error: err }
            })
            
            if (playerError || !playerData) {
              console.error('🎮 Error finding player:', playerError)
              if (isMounted) {
                setPlayerTeams([])
                setPlayerSeasons([])
              }
              return
            }
            if (playerData.length > 0) {
              playerIds = playerData.map(p => p.id)
            }
          } else if (user.role === 'parent') {
            // For parents: get their connected players with timeout
            const parentResult = await withShortTimeout(
              supabase
                .from('icepulse_parents')
                .select('id')
                .eq('profile_id', user.id)
                .limit(1)
                .maybeSingle(),
              5000
            ).catch(err => {
              console.error('👨‍👩‍👧‍👦 Parent query timeout:', err)
              return { data: null, error: err }
            })
            
            if (parentResult.error || !parentResult.data?.id) {
              console.error('👨‍👩‍👧‍👦 Error finding parent record:', parentResult.error)
              if (isMounted) {
                setPlayerTeams([])
                setPlayerSeasons([])
              }
              return
            }
            
            const connectionsResult = await withShortTimeout(
              supabase
                .from('icepulse_parent_player_connections')
                .select('player_id')
                .eq('parent_id', parentResult.data.id),
              5000
            ).catch(err => {
              console.error('👨‍👩‍👧‍👦 Connections query timeout:', err)
              return { data: null, error: err }
            })
            
            if (connectionsResult.error || !connectionsResult.data) {
              console.error('👨‍👩‍👧‍👦 Error finding player connections:', connectionsResult.error)
              if (isMounted) {
                setPlayerTeams([])
                setPlayerSeasons([])
              }
              return
            }
            
            if (connectionsResult.data.length > 0) {
              playerIds = connectionsResult.data.map(c => c.player_id)
            }
          }
          
          if (playerIds.length === 0) {
            console.warn('🎮 No player IDs found')
            if (isMounted) {
              setPlayerTeams([])
              setPlayerSeasons([])
            }
            return
          }
          
          // Get assignments with timeout
          const assignmentsResult = await withShortTimeout(
            supabase
              .from('icepulse_player_assignments')
              .select('team_id, season_id')
              .in('player_id', playerIds)
              .limit(50), // Limit to prevent huge queries
            5000
          ).catch(err => {
            console.error('🎮 Assignments query timeout:', err)
            return { data: null, error: err }
          })
          
          if (assignmentsResult.error || !assignmentsResult.data) {
            console.error('🎮 Error fetching assignments:', assignmentsResult.error)
            if (isMounted) {
              setPlayerTeams([])
              setPlayerSeasons([])
            }
            return
          }
          
          const assignments = assignmentsResult.data
          if (assignments.length === 0) {
            console.warn('🎮 No assignments found')
            if (isMounted) {
              setPlayerTeams([])
              setPlayerSeasons([])
            }
            return
          }
          
          const teamIds = [...new Set(assignments.map(a => a.team_id).filter(Boolean))]
          const seasonIds = [...new Set(assignments.map(a => a.season_id).filter(Boolean))]
          
          console.log('🎮 Extracted IDs:', { teamIds: teamIds.length, seasonIds: seasonIds.length })
          
          // Fetch teams first, then seasons separately to avoid parallel overload
          let teams = []
          if (teamIds.length > 0) {
            try {
              const teamsResult = await withShortTimeout(
                supabase.from('icepulse_teams').select('id, name').in('id', teamIds).limit(10),
                3000 // Keep fast for dropdown
              )
              teams = (teamsResult.data || []).map(t => ({ id: t.id, name: t.name }))
              console.log('🎮 Teams loaded:', teams.length)
            } catch (err) {
              console.error('🎮 Teams query failed:', err)
              // Continue with empty teams - we can still show seasons
            }
          }
          
          // Now fetch seasons (separately to avoid parallel queries)
          let seasons = []
          if (seasonIds.length > 0) {
            try {
              // Add a small delay to prevent overwhelming the database
              await new Promise(resolve => setTimeout(resolve, 200))
              if (abortController.signal.aborted || !isMounted) return
              
              const seasonsResult = await withShortTimeout(
                supabase.from('icepulse_seasons').select('id, name').in('id', seasonIds).limit(10),
                8000 // Increased timeout for RLS policy checks (parent access through player assignments)
              )
              seasons = (seasonsResult.data || []).map(s => ({ id: s.id, name: s.name }))
              console.log('🎮 Seasons loaded:', seasons.length)
            } catch (err) {
              console.error('🎮 Seasons query failed:', err)
              // Continue without seasons - better than crashing
            }
          }
          
          console.log('🎮 Final teams/seasons:', { teams: teams.length, seasons: seasons.length })
          
          if (isMounted && !abortController.signal.aborted) {
            setPlayerTeams(teams)
            setPlayerSeasons(seasons)
          }
        } catch (error) {
          console.error('🎮 Error loading teams/seasons:', error)
          if (isMounted) {
            setPlayerTeams([])
            setPlayerSeasons([])
          }
        }
      }
    }
    
    loadPlayerTeamsAndSeasons()
    
    return () => {
      isMounted = false // Cleanup
      abortController.abort() // Cancel any pending requests
    }
  }, [user?.id, user?.role])
  
  // Use organization teams/seasons if available, otherwise use player teams/seasons
  // For organization users: load teams/seasons directly if organization isn't loaded yet
  const [orgTeams, setOrgTeams] = useState([])
  const [orgSeasons, setOrgSeasons] = useState([])
  
  // Load teams/seasons for organization users if organization isn't loaded or has empty teams/seasons
  useEffect(() => {
    const loadOrgTeamsAndSeasons = async () => {
      const isOrgUser = user?.role === 'organization' || user?.role === 'coach'
      if (!isOrgUser || !user?.id) {
        return
      }
      
      // Always try to load if the context data is empty, regardless of loading state
      const orgHasTeams = organization?.teams && organization.teams.length > 0
      const orgHasSeasons = organization?.seasons && organization.seasons.length > 0
      const needsLoad = !orgHasTeams || !orgHasSeasons
      
      if (needsLoad) {
        console.log('🏢 Loading teams/seasons for organization user:', user.id)
        
        try {
          let orgId = organization?.id
          
          // If organization ID not available, find it directly from DB
          if (!orgId) {
            const { data: ownedOrgs } = await supabase
              .from('icepulse_organizations')
              .select('id')
              .eq('owner_id', user.id)
              .limit(1)
              .maybeSingle()
            
            if (ownedOrgs) {
              orgId = ownedOrgs.id
              console.log('✅ Found organization ID directly:', orgId)
            }
          }
          
          if (!orgId) return

          // Load teams directly using organization_id
          if (!orgHasTeams) {
            const { data: teamsData } = await supabase
              .from('icepulse_teams')
              .select('id, name')
              .eq('organization_id', orgId)
              .order('name', { ascending: true })
              .limit(100)
            
            if (teamsData) {
              setOrgTeams(teamsData)
              console.log('✅ Loaded teams direct:', teamsData.length)
            }
          }
          
          // Load seasons directly using organization_id
          if (!orgHasSeasons) {
            const { data: seasonsData } = await supabase
              .from('icepulse_seasons')
              .select('id, name')
              .eq('organization_id', orgId)
              .order('name', { ascending: true })
              .limit(50)
            
            if (seasonsData) {
              setOrgSeasons(seasonsData)
              console.log('✅ Loaded seasons direct:', seasonsData.length)
            }
          }
        } catch (err) {
          console.error('❌ Error loading organization teams/seasons:', err)
        }
      } else {
        // If organization context has data, clear local state to prefer context
        setOrgTeams([])
        setOrgSeasons([])
      }
    }
    
    loadOrgTeamsAndSeasons()
  }, [user?.id, user?.role, organization?.id, organization?.teams, organization?.seasons])
  
  // Use manually loaded teams/seasons if organization doesn't have them, otherwise use organization's
  const availableTeams = (organization?.teams && organization.teams.length > 0) 
    ? organization.teams 
    : (orgTeams.length > 0 ? orgTeams : playerTeams)
  const availableSeasons = (organization?.seasons && organization.seasons.length > 0) 
    ? organization.seasons 
    : (orgSeasons.length > 0 ? orgSeasons : playerSeasons)
  const [isRecording, setIsRecording] = useState(false)
  const [chunks, setChunks] = useState([])
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [isRequesting, setIsRequesting] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [facingMode, setFacingMode] = useState('environment') // 'environment' = back, 'user' = front
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [recordingStartTimestamp, setRecordingStartTimestamp] = useState(null)
  const [showEventModal, setShowEventModal] = useState(true)
  const [eventType, setEventType] = useState(null) // 'game' | 'practice' | 'skills'
  const [eventSummary, setEventSummary] = useState('')
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)

  // Event form fields
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [eventTime, setEventTime] = useState(() => new Date().toTimeString().slice(0, 5))
  const [eventOpponent, setEventOpponent] = useState('')
  const [eventTeamId, setEventTeamId] = useState('')
  const [eventSeasonId, setEventSeasonId] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventNotes, setEventNotes] = useState('')
  const [eventExistingGameId, setEventExistingGameId] = useState('')
  const [eventUseManualGame, setEventUseManualGame] = useState(false)
  const [enableLiveStreaming, setEnableLiveStreaming] = useState(false)
  const [hasStreamingPermission, setHasStreamingPermission] = useState(false)
  const [isCheckingPermission, setIsCheckingPermission] = useState(false)
  const videoRef = useRef(null)

  // Check streaming permission when modal opens and user is available
  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.id || !checkStreamingPermission) {
        setHasStreamingPermission(false)
        return
      }
      
      // Organization users and users with explicit permission can stream
      const isOrgUser = user?.role === 'organization' || user?.role === 'coach'
      if (isOrgUser) {
        setHasStreamingPermission(true)
        return
      }
      
      // For other users, check their profile permission
      setIsCheckingPermission(true)
      try {
        const hasPermission = await checkStreamingPermission(user.id)
        setHasStreamingPermission(hasPermission)
      } catch (error) {
        console.error('Error checking streaming permission:', error)
        setHasStreamingPermission(false)
      } finally {
        setIsCheckingPermission(false)
      }
    }
    
    if (showEventModal) {
      checkPermission()
    }
  }, [showEventModal, user?.id, user?.role, checkStreamingPermission])
  const videoContainerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunkIntervalRef = useRef(null)
  const streamRef = useRef(null)
  const isRecordingRef = useRef(false)
  const recordedBlobsRef = useRef([])
  const currentGameIdRef = useRef(null) // Store gameId for the current recording session
  const currentStartTimestampRef = useRef(null) // Store start timestamp for the current recording session
  const whipUrlRef = useRef(null) // Store WHIP URL for broadcasting
  const whipPeerConnectionRef = useRef(null) // Store WebRTC connection for broadcasting
  const [streamId, setStreamId] = useState(null)
  const [streamUrl, setStreamUrl] = useState(null)
  const [orgStreamsUrl, setOrgStreamsUrl] = useState(null)
  const [rtmpsUrl, setRtmpsUrl] = useState(null)
  const [rtmpsKey, setRtmpsKey] = useState(null)
  const [urlCopied, setUrlCopied] = useState(false)
  const [rtmpsUrlCopied, setRtmpsUrlCopied] = useState(false)
  const [rtmpsKeyCopied, setRtmpsKeyCopied] = useState(false)
  const [rtmpsComboCopied, setRtmpsComboCopied] = useState(false)
  const [hasCopiedBroadcastId, setHasCopiedBroadcastId] = useState(false)
  const [showLarixModal, setShowLarixModal] = useState(false)
  const [isCreatingStream, setIsCreatingStream] = useState(false)
  const [recentlyStoppedStream, setRecentlyStoppedStream] = useState(null)
  const streamChunkIndexRef = useRef(0)
  const streamChunkIntervalRef = useRef(null)
  const streamChunksRef = useRef([]) // Store chunks for streaming
  const isSegmentStopRef = useRef(false) // Track if stop is for segment (streaming) vs final stop

  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      // On mobile, try to identify front vs back cameras
      const frontCameras = []
      const backCameras = []
      
      videoDevices.forEach(device => {
        const label = device.label.toLowerCase()
        // Front camera indicators
        if (label.includes('front') || label.includes('user') || label.includes('facing') || label.includes('selfie')) {
          frontCameras.push(device)
        }
        // Back camera indicators
        else if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('world')) {
          backCameras.push(device)
        }
        // If we can't tell, assume it's back camera (default preference)
        else {
          backCameras.push(device)
        }
      })
      
      // Find default camera
      let defaultCamera = null
      if (videoDevices.length > 0) {
        if (isMobile) {
          // On mobile, prefer back camera (environment)
          defaultCamera = backCameras[0] || frontCameras[0] || videoDevices[0]
        } else {
          // On desktop, try to find built-in camera
        defaultCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('built-in') ||
          device.label.toLowerCase().includes('facetime') ||
          device.label.toLowerCase().includes('integrated')
          ) || videoDevices[0]
        }
        
        setCameras(videoDevices)
        if (!selectedCameraId) {
          setSelectedCameraId(defaultCamera.deviceId)
        }
      }
      
      return videoDevices
    } catch (err) {
      console.warn('Error enumerating devices:', err)
      return []
    }
  }

  const getLarixStoreLink = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    const isAndroid = /Android/i.test(ua)
    if (isIOS) {
      return 'https://apps.apple.com/us/app/larix-broadcaster/id1042474385'
    }
    if (isAndroid) {
      return 'https://play.google.com/store/apps/details?id=com.wmspanel.larix_broadcaster'
    }
    return 'https://softvelum.com/larix/'
  }

  const isMobileDevice = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  }

  const copyTextToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch (err) {
      console.warn('Clipboard API failed, falling back:', err)
    }

    try {
      const temp = document.createElement('textarea')
      temp.value = text
      temp.style.position = 'fixed'
      temp.style.opacity = '0'
      document.body.appendChild(temp)
      temp.focus()
      temp.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(temp)
      if (copied) return true
    } catch (err) {
      console.warn('execCommand copy failed, falling back:', err)
    }

    const manualCopy = window.prompt('Copy this Broadcast ID:', text)
    return manualCopy !== null
  }

  const applyStreamData = (streamData, gameId) => {
    if (!streamData?.id) return
    setStreamId(streamData.id)
    setStreamUrl(`${window.location.origin}/game/${gameId}/streams`)
    if (organization?.id) {
      setOrgStreamsUrl(`${window.location.origin}/org/${organization.id}/streams`)
    }
    if (streamData.whipUrl) {
      whipUrlRef.current = streamData.whipUrl
    }
    if (streamData.rtmpsKey) {
      setRtmpsKey(streamData.rtmpsKey)
      setRtmpsUrl(streamData.rtmpsUrl || 'rtmps://global-live.mux.com:443/app')
    }
  }

  const ensureStreamForLiveToggle = async () => {
    if (!hasStreamingPermission || !createStream) return
    const gameId = selectedGameId || eventExistingGameId || currentGameIdRef.current
    if (!gameId) return
    if (rtmpsKey) return
    setIsCreatingStream(true)
    try {
      const streamData = await createStream(gameId)
      applyStreamData(streamData, gameId)
    } catch (err) {
      console.error('❌ Error creating stream on toggle:', err)
      setError(`Stream creation failed: ${err.message}. You can still record locally.`)
    } finally {
      setIsCreatingStream(false)
    }
  }

  const requestMediaAccess = async (cameraId = null, facingModeOverride = null) => {
    setIsRequesting(true)
    setError(null)
    
    // Stop existing stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    try {
      // Build video constraints
      let videoConstraints = {}
      
      if (cameraId) {
        // If specific camera ID is provided, use it
        videoConstraints = { deviceId: { exact: cameraId } }
      } else if (isMobile && (facingModeOverride || facingMode)) {
        // On mobile, use facingMode to get front/back camera
        const mode = facingModeOverride || facingMode
        videoConstraints = { facingMode: mode }
      } else {
        // Default: just request video
        videoConstraints = true
      }
      
      // Always request audio initially to get permission, then we can toggle it
      const constraints = {
        video: videoConstraints,
        audio: true // Always request audio for permission, we'll toggle tracks
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Set audio tracks based on audioEnabled state
      const audioTracks = mediaStream.getAudioTracks()
      audioTracks.forEach(track => {
        track.enabled = audioEnabled
      })
      
      streamRef.current = mediaStream
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setError(null)
      
      // Get available cameras after getting permission
      await getAvailableCameras()
    } catch (err) {
      let errorMessage = 'Unable to access camera and microphone.'
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError') {
        errorMessage = 'Camera and microphone access was denied. Please allow access in your browser settings and try again.'
        // Don't log permission errors to console - user action, UI shows feedback
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device and try again.'
        // Log device not found errors for debugging
        console.warn('Media device not found:', err)
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera or microphone is already in use by another application.'
        // Log device in use errors for debugging
        console.warn('Media device not readable:', err)
      } else {
        // Log unexpected errors
        console.error('Unexpected error accessing media devices:', err)
      }
      
      setError(errorMessage)
    } finally {
      setIsRequesting(false)
    }
  }

  const switchCamera = async (cameraId) => {
    if (isRecording) {
      // Can't switch camera while recording
      return
    }
    
    setSelectedCameraId(cameraId)
    await requestMediaAccess(cameraId)
  }

  // Flip between front and back camera on mobile
  const flipCamera = async () => {
    if (isRecording) {
      // Can't switch camera while recording
      return
    }
    
    if (!isMobile) {
      // On desktop, just cycle through available cameras
      if (cameras.length > 1) {
        const currentIndex = cameras.findIndex(c => c.deviceId === selectedCameraId)
        const nextIndex = (currentIndex + 1) % cameras.length
        await switchCamera(cameras[nextIndex].deviceId)
      }
      return
    }
    
    // On mobile, flip between front and back using facingMode
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newFacingMode)
    setSelectedCameraId(null) // Clear selected ID so facingMode is used
    await requestMediaAccess(null, newFacingMode)
    
    // After switching, try to find the matching camera device
    // This helps with camera enumeration later
    try {
      await getAvailableCameras()
    } catch (err) {
      console.warn('Could not enumerate cameras after flip:', err)
    }
  }

  const toggleAudio = () => {
    if (!streamRef.current) return
    
    const audioTracks = streamRef.current.getAudioTracks()
    const newAudioState = !audioEnabled
    
    audioTracks.forEach(track => {
      track.enabled = newAudioState
    })
    
    setAudioEnabled(newAudioState)
  }

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' && window.innerWidth <= 768)
      setIsMobile(isMobileDevice)
      // Default to back camera on mobile
      if (isMobileDevice) {
        setFacingMode('environment')
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    // On mobile, request back camera by default; on desktop, use default camera
    // Only run once on mount, not when isMobile changes
    const initialRequest = async () => {
      // Wait a bit for mobile detection to complete
      await new Promise(resolve => setTimeout(resolve, 100))
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' && window.innerWidth <= 768)
      
      if (isMobileDevice) {
        await requestMediaAccess(null, 'environment') // Back camera
      } else {
        await requestMediaAccess()
      }
    }
    initialRequest()

    // Handle fullscreen changes (user might exit fullscreen manually)
    const handleFullscreenChange = () => {
      const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
      
      // If user exits fullscreen while recording, stop recording
      if (!isFullscreen && isRecordingRef.current) {
        stopRecording()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current)
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  // When leaving recording screen / reopening, default to requiring event selection
  useEffect(() => {
    if (!selectedGameId) {
      setShowEventModal(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check for recently stopped streams when game is selected
  useEffect(() => {
    const checkRecentlyStoppedStream = async () => {
      if (!selectedGameId || !getRecentlyStoppedStream || isRecording) {
        setRecentlyStoppedStream(null)
        return
      }

      try {
        const stoppedStream = await getRecentlyStoppedStream(selectedGameId)
        setRecentlyStoppedStream(stoppedStream)
        if (stoppedStream) {
          console.log('📹 Found recently stopped stream that can be resumed:', stoppedStream.id)
        }
      } catch (error) {
        console.error('Error checking for recently stopped stream:', error)
        setRecentlyStoppedStream(null)
      }
    }

    checkRecentlyStoppedStream()
    // Check every 30 seconds to update the resume option
    const interval = setInterval(checkRecentlyStoppedStream, 30000)
    return () => clearInterval(interval)
  }, [selectedGameId, getRecentlyStoppedStream, isRecording])

  const computeEventLabelFromGame = (game) => {
    if (!game) return ''
    const date = game.gameDate ? new Date(game.gameDate) : null
    const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No Date'
    const timeStr = game.gameTime ? game.gameTime.slice(0, 5) : ''
    const team = availableTeams.find(t => t.id === game.teamId) || organization?.teams?.find(t => t.id === game.teamId)
    const eventType = game.eventType || 'game'
    
    if (eventType === 'game') {
      return game.opponent
        ? `${dateStr}${timeStr ? ` ${timeStr}` : ''} — ${team?.name || 'Team'} vs ${game.opponent}`
        : `${dateStr}${timeStr ? ` ${timeStr}` : ''} — ${team?.name || 'Team'} Game`
    } else if (eventType === 'practice') {
      return `${dateStr}${timeStr ? ` ${timeStr}` : ''} — ${team?.name || 'Team'} • Practice`
    } else if (eventType === 'skills') {
      return `${dateStr}${timeStr ? ` ${timeStr}` : ''} — ${team?.name || 'Team'} • Skills`
    }
    return `${dateStr}${timeStr ? ` ${timeStr}` : ''} — ${team?.name || 'Team'}`
  }

  const createThumbnailAndDuration = async (videoBlob) => {
    const url = URL.createObjectURL(videoBlob)
    try {
      const videoEl = document.createElement('video')
      videoEl.src = url
      videoEl.muted = true
      videoEl.playsInline = true
      await new Promise((resolve, reject) => {
        videoEl.onloadedmetadata = () => resolve()
        videoEl.onerror = () => reject(new Error('Failed to load video metadata'))
      })

      const durationSeconds = Number.isFinite(videoEl.duration) ? Math.round(videoEl.duration) : null

      // Seek to a tiny offset to grab a frame
      const targetTime = Math.min(0.1, Math.max(0, (videoEl.duration || 0) * 0.05))
      try {
        videoEl.currentTime = targetTime
        await new Promise((resolve) => {
          videoEl.onseeked = () => resolve()
        })
      } catch {
        // If seeking fails, continue with current frame
      }

      const canvas = document.createElement('canvas')
      canvas.width = videoEl.videoWidth || 640
      canvas.height = videoEl.videoHeight || 360
      const ctx = canvas.getContext('2d')
      if (!ctx) return { thumbnailUrl: null, durationSeconds }
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.72)
      return { thumbnailUrl, durationSeconds }
    } catch (e) {
      console.warn('Thumbnail generation failed:', e)
      return { thumbnailUrl: null, durationSeconds: null }
    } finally {
      // Don't revoke `url` here because we currently store blob URLs as video_url.
      // In production (storage URLs), we'd revoke the temporary URL.
    }
  }

  const ensureEventSelected = async () => {
    // Guard: If we already have a selectedGameId, ensure ref is also set
    if (selectedGameId) {
      currentGameIdRef.current = selectedGameId
      console.log('✅ Game already selected, ensuring ref is set:', selectedGameId)
      return true
    }

    if (!eventType) {
      setError('Please choose what you are recording (Game, Practice, or Skills).')
      setShowEventModal(true)
      return false
    }

    // For players/parents: allow creating games directly without organization context
    const isPlayerOrParent = user?.role === 'player' || user?.role === 'parent'
    const isOrganizationUser = user?.role === 'organization' || user?.role === 'coach'
    
    if (isPlayerOrParent) {
      // For players/parents, we'll create games directly
      // They don't need organization context - they have teams/seasons from their assignments
      console.log('🎮 Player/Parent: Creating game without organization context')
    } else if (isOrganizationUser) {
      // For organization users: allow to proceed even if organization isn't loaded
      // We can fetch organization_id from the selected team and use database function
      if (isOrganizationLoading) {
        // Only block if organization is actively loading (wait a bit)
        setError('Organization is still loading. Please wait a moment and try again.')
        return false
      }
      
      // If organization isn't loaded but we have teams/seasons available, allow to proceed
      // The game creation logic will handle fetching organization_id from team
      if (!organization?.id && availableTeams.length === 0 && availableSeasons.length === 0) {
        setError('Organization not found. Please ensure you have created an organization and have teams/seasons set up.')
        return false
      }
      
      console.log(`🏢 Organization user: ${organization?.id ? 'Organization loaded' : 'Will fetch organization from team'}`)
    } else {
      // For other roles, require organization context
    if (!organization?.id || !addGame) {
      setError('Event setup requires organization access.')
      return false
      }
    }

    // All new events require team+season due to DB constraints
    const requireTeamSeason = (teamId, seasonId) => {
      if (!teamId) return 'Please select a team.'
      if (!seasonId) return 'Please select a season/tournament.'
      return null
    }

    // If an existing event is selected (game, practice, or skills), use it
    if (!eventUseManualGame && eventExistingGameId) {
      // Set both state and ref immediately
      setSelectedGameId(eventExistingGameId)
      currentGameIdRef.current = eventExistingGameId
      const g = organization?.games?.find(x => x.id === eventExistingGameId)
      setEventSummary(g ? computeEventLabelFromGame(g) : 'Event selected')
      
      // Create stream for this event only if streaming is enabled
      let streamData = null
      
      if (enableLiveStreaming && hasStreamingPermission) {
      try {
        console.log('🔄 Creating stream for event:', eventExistingGameId)
        
        // Use createStream from OrgContext (Now Cloudflare-powered)
        if (createStream) {
          streamData = await createStream(eventExistingGameId)
          console.log('✅ Stream created:', streamData)
        } else {
          console.warn('⚠️ createStream function not available')
          setError('Streaming unavailable. Recording will still work.')
        }
      } catch (err) {
        console.error('❌ Error creating stream:', err)
        setError(`Stream creation failed: ${err.message}. You can still record locally.`)
      }
      
      // Set stream data if we have it
      if (streamData?.id) {
        setStreamId(streamData.id)
        // Use the game stream hub URL (shows all active streams for this game)
        const appViewerUrl = `${window.location.origin}/game/${eventExistingGameId}/streams`
          setStreamUrl(appViewerUrl)
        if (organization?.id) {
          setOrgStreamsUrl(`${window.location.origin}/org/${organization.id}/streams`)
        }
        // Store WHIP info for broadcasting
        if (streamData.whipUrl) {
           whipUrlRef.current = streamData.whipUrl
        }
        if (streamData.rtmpsKey) {
          setRtmpsKey(streamData.rtmpsKey)
          setRtmpsUrl(streamData.rtmpsUrl || 'rtmps://global-live.mux.com:443/app')
        }
        console.log('✅ Stream setup complete:', streamData.id)
      } else {
        console.warn('⚠️ Stream created but no ID returned')
        }
      } else {
        console.log('ℹ️ Live streaming not enabled for this recording')
      }
      
      console.log('✅ Existing event selected, gameId set:', eventExistingGameId)
      return true
    }

    // Guard: If already creating, don't create again
    if (isCreatingEvent) {
      return false
    }

    // Manual game / practice / skills -> create a game row first
    const teamSeasonErr = requireTeamSeason(eventTeamId, eventSeasonId)
    if (teamSeasonErr) {
      setError(teamSeasonErr)
      return false
    }

    if (eventType === 'game') {
      if (!eventOpponent.trim()) {
        setError('Please enter an opponent for this game.')
        return false
      }
    }

    const opponent =
      eventType === 'practice' ? 'Practice' :
      eventType === 'skills' ? 'Skills' :
      eventOpponent.trim()

    setIsCreatingEvent(true)
    try {
      let created = null
      
      if (isPlayerOrParent) {
        // For players/parents: create game directly without organization context
        // Fetch organization_id from team (we don't store it in dropdown to keep it fast)
        console.log('🎮 Fetching organization_id for team:', eventTeamId)
        const { data: teamData, error: teamError } = await withShortTimeout(
          supabase
            .from('icepulse_teams')
            .select('id, organization_id')
            .eq('id', eventTeamId)
            .limit(1)
            .maybeSingle(),
          8000 // Longer timeout for RLS policy checks - acceptable since this is a one-time operation
        ).catch(err => ({ data: null, error: err }))
        
        if (teamError || !teamData) {
          console.error('❌ Error fetching team:', teamError)
          setError(`Failed to load team information: ${teamError?.message || 'Query timeout'}. Please try again.`)
          setIsCreatingEvent(false)
          return false
        }
        
        const organizationId = teamData.organization_id
        if (!organizationId) {
          console.error('❌ No organization_id found for team:', eventTeamId)
          setError('Failed to determine organization for this team. Please try again.')
          setIsCreatingEvent(false)
          return false
        }
        
        console.log('✅ Found organization_id:', organizationId)
        
        // Use database function to create game efficiently, bypassing complex RLS checks
        console.log('🎮 Using database function to create game')
        const { data: gameData, error: gameError } = await withShortTimeout(
          supabase.rpc('create_game_for_player_parent', {
            p_user_id: user.id,
            p_user_role: user.role,
            p_team_id: eventTeamId,
            p_season_id: eventSeasonId,
            p_opponent: opponent,
            p_game_date: eventDate,
            p_game_time: eventTime || null,
            p_location: eventLocation?.trim() || null,
            p_notes: eventNotes?.trim() || (eventType === 'practice' ? 'Practice recording' : eventType === 'skills' ? 'Skills recording' : 'Game created from recorder')
          }),
          10000 // 10 second timeout for the function
        ).catch(err => {
          console.error('❌ Database function error:', err)
          return { data: null, error: err }
        })
        
        if (gameError || !gameData || (Array.isArray(gameData) && gameData.length === 0)) {
          console.error('❌ Error creating game:', gameError)
          setError(`Failed to create event: ${gameError?.message || 'Unknown error'}`)
          setIsCreatingEvent(false)
          return false
        }
        
        // Handle array response from function
        const game = Array.isArray(gameData) ? gameData[0] : gameData
        
        created = {
          id: game.id,
          gameDate: game.game_date,
          gameTime: game.game_time
        }
        
        console.log('✅ Game created directly for player/parent:', created.id)
      } else if (isOrganizationUser) {
        // For organization users: try to use addGame if available, otherwise use database function
        if (addGame && organization?.id) {
          // Use addGame from OrgContext if organization is loaded
          console.log('🏢 Organization user: Using addGame from OrgContext')
          try {
            created = await addGame({
        teamId: eventTeamId,
        seasonId: eventSeasonId,
        gameDate: eventDate,
        gameTime: eventTime || null,
        opponent,
        location: eventLocation?.trim() || null,
        notes: eventNotes?.trim() || (eventType === 'practice' ? 'Practice recording' : eventType === 'skills' ? 'Skills recording' : 'Game created from recorder')
      })
          } catch (addGameError) {
            console.error('❌ Error using addGame, falling back to database function:', addGameError)
            // Fall through to database function approach
            created = null
          }
        }
        
        // If addGame failed or organization isn't loaded, use database function
        if (!created) {
          // Fetch organization_id from the selected team
          console.log('🏢 Organization user: Fetching organization_id for team:', eventTeamId)
          const { data: teamData, error: teamError } = await withShortTimeout(
            supabase
              .from('icepulse_teams')
              .select('id, organization_id')
              .eq('id', eventTeamId)
              .limit(1)
              .maybeSingle(),
            8000
          ).catch(err => ({ data: null, error: err }))
          
          if (teamError || !teamData || !teamData.organization_id) {
            console.error('❌ Error fetching team for organization user:', teamError)
            setError(`Failed to load team information: ${teamError?.message || 'Query timeout'}. Please ensure you have an organization and try again.`)
            setIsCreatingEvent(false)
            return false
          }
          
          // Note: Organization ownership verification is done in the database function
          // The function will check if user owns the organization or is a coach assigned to it
          console.log('🏢 Creating game via database function (will verify ownership in function)')
          
          // Use database function to create game (supports organization/coach roles now)
          const { data: gameData, error: gameError } = await withShortTimeout(
            supabase.rpc('create_game_for_player_parent', {
              p_user_id: user.id,
              p_user_role: user.role,
              p_team_id: eventTeamId,
              p_season_id: eventSeasonId,
              p_opponent: opponent,
              p_game_date: eventDate,
              p_game_time: eventTime || null,
              p_location: eventLocation?.trim() || null,
              p_notes: eventNotes?.trim() || (eventType === 'practice' ? 'Practice recording' : eventType === 'skills' ? 'Skills recording' : 'Game created from recorder')
            }),
            10000
          ).catch(err => {
            console.error('❌ Database function error:', err)
            return { data: null, error: err }
          })
          
          if (gameError || !gameData || (Array.isArray(gameData) && gameData.length === 0)) {
            console.error('❌ Error creating game:', gameError)
            setError(`Failed to create event: ${gameError?.message || 'Unknown error'}. Please ensure you own this organization or are assigned as a coach.`)
            setIsCreatingEvent(false)
            return false
          }
          
          // Handle array response from function
          const game = Array.isArray(gameData) ? gameData[0] : gameData
          
          created = {
            id: game.id,
            gameDate: game.game_date,
            gameTime: game.game_time
          }
          
          console.log('✅ Game created via database function for organization user:', created.id)
        }
      } else if (addGame && organization?.id) {
        // For org users with loaded organization: use addGame from OrgContext
        created = await addGame({
        teamId: eventTeamId,
        seasonId: eventSeasonId,
        gameDate: eventDate,
        gameTime: eventTime || null,
        opponent,
        location: eventLocation?.trim() || null,
        notes: eventNotes?.trim() || (eventType === 'practice' ? 'Practice recording' : eventType === 'skills' ? 'Skills recording' : 'Game created from recorder')
      })
      } else {
        setError('Unable to create games. Please refresh the page and ensure you have an organization.')
        setIsCreatingEvent(false)
        return false
      }

      if (!created?.id) {
        setError('Failed to create event. Please try again.')
        setIsCreatingEvent(false)
        return false
      }

      // Set both state and ref immediately
      setSelectedGameId(created.id)
      currentGameIdRef.current = created.id
      setEventSummary(`${eventType === 'game' ? 'Game' : eventType === 'practice' ? 'Practice' : 'Skills'} — ${created.gameDate} ${created.gameTime || ''}`.trim())
      
      // Create stream for this game only if streaming is enabled
      let streamData = null
      
      if (enableLiveStreaming && hasStreamingPermission) {
      try {
        console.log('🔄 Creating stream for new game:', created.id)
        
        // Use createStream from OrgContext (Now Cloudflare-powered)
        if (createStream) {
          streamData = await createStream(created.id)
          console.log('✅ Stream created:', streamData)
        } else {
          console.warn('⚠️ createStream function not available')
          setError('Streaming unavailable. Recording will still work.')
        }
      } catch (err) {
        console.error('❌ Error creating stream:', err)
        setError(`Stream creation failed: ${err.message}. You can still record locally.`)
        }
      } else {
        console.log('ℹ️ Live streaming not enabled for this recording')
      }
      
      // Set stream data if we have it
      if (streamData?.id) {
        setStreamId(streamData.id)
        // Use the game stream hub URL (shows all active streams for this game)
        const appViewerUrl = `${window.location.origin}/game/${created.id}/streams`
        setStreamUrl(appViewerUrl)
        if (organization?.id) {
          setOrgStreamsUrl(`${window.location.origin}/org/${organization.id}/streams`)
        }
        if (streamData.rtmpsKey) {
          setRtmpsKey(streamData.rtmpsKey)
          setRtmpsUrl(streamData.rtmpsUrl || 'rtmps://global-live.mux.com:443/app')
        }
        console.log('✅ Stream setup complete:', streamData.id)
      } else {
        console.log('ℹ️ No stream created (streaming disabled or not available)')
      }
      
      console.log('✅ Event created and gameId set:', created.id)
      
      // Don't close modal - let user see stream URL and start recording
      // Modal will stay open so user can copy/share the stream URL and start recording
      
      return true
    } catch (e) {
      console.error('Error creating event:', e)
      setError('Failed to create event. Please try again.')
      return false
    } finally {
      setIsCreatingEvent(false)
    }
  }

  const startRecording = async (resumeStreamId = null) => {
    if (!stream) {
      console.warn('⚠️ Cannot start recording: No camera stream available')
      return
    }
    
    // Reset any previous recording state
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.warn('⚠️ MediaRecorder still active, stopping first...')
      try {
        mediaRecorderRef.current.stop()
      } catch (e) {
        console.warn('Error stopping previous recorder:', e)
      }
      // Clear the ref to ensure we create a new one
      mediaRecorderRef.current = null
    }
    
    const ok = await ensureEventSelected()
    if (!ok) {
      console.warn('⚠️ ensureEventSelected returned false, cannot start recording')
      return
    }

    // Ensure ref is set (should already be set by ensureEventSelected, but double-check)
    // Also check state in case ref wasn't set
    const gameIdToUse = currentGameIdRef.current || selectedGameId
    if (gameIdToUse && !currentGameIdRef.current) {
      currentGameIdRef.current = gameIdToUse
    }
    
    if (!currentGameIdRef.current) {
      console.error('❌ No gameId available when starting recording!', {
        refValue: currentGameIdRef.current,
        stateValue: selectedGameId,
        eventType,
        showEventModal
      })
      setError('Cannot start recording: No event selected. Please select an event first.')
      return
    }
    
    console.log('🎬 Starting recording with gameId:', currentGameIdRef.current, 'state gameId:', selectedGameId, 'resumeStreamId:', resumeStreamId)

    // Reactivate stream if it exists (for restarting recording)
    let nextChunkIndex = 0
    let whipUrlToUse = null

    // Helper to push stream via WHIP
    const pushToWhip = async (url, mediaStream) => {
      try {
        console.log('📡 [WHIP] Starting broadcast initialization to:', url)
        
        // Explicitly set bundle policy and ICE transport policy
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        })
        
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            // Filter out mDNS candidates if possible (Cloudflare prefers IP candidates)
            console.log('📡 [WHIP] ICE Candidate found:', e.candidate.candidate.substring(0, 40) + '...')
          }
        }

        pc.onconnectionstatechange = () => {
          console.log('📡 [WHIP] PeerConnection State Change:', pc.connectionState)
          if (pc.connectionState === 'connected') {
            console.log('✅ [WHIP] MEDIA FLOWING TO CLOUDFLARE')
          }
        }

        // Use addTransceiver for exact control over direction
        mediaStream.getTracks().forEach(track => {
          console.log(`📡 [WHIP] Adding ${track.kind} track...`)
          pc.addTransceiver(track, { direction: 'sendonly', streams: [mediaStream] })
        })

        // Force H264 on the video transceiver
        try {
          const transceivers = pc.getTransceivers()
          transceivers.forEach(t => {
            if (t.sender.track?.kind === 'video') {
              const cap = RTCRtpSender.getCapabilities('video')
              const h264 = cap?.codecs.filter(c => 
                c.mimeType?.toLowerCase() === 'video/h264' && 
                c.sdpFmtpLine?.includes('profile-level-id=42e01f')
              ) || []
              if (h264.length > 0) t.setCodecPreferences(h264)
            }
          })
        } catch (e) {}
        
        console.log('📡 [WHIP] Creating Offer...')
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        console.log('📡 [WHIP] Waiting for ICE gathering (max 3s)...')
        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') resolve()
          else {
            const check = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); } }
            pc.addEventListener('icegatheringstatechange', check)
            setTimeout(resolve, 3000)
          }
        })
        
        console.log('📡 [WHIP] Sending Offer to Cloudflare (SDP length:', pc.localDescription.sdp.length, ')')
        const response = await fetch(url, {
          method: 'POST',
          body: pc.localDescription.sdp,
          headers: { 'Content-Type': 'application/sdp' }
        })
        
        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`WHIP HTTP Error ${response.status}: ${errText || response.statusText}`)
        }
        
        const answerSdp = await response.text()
        console.log('📡 [WHIP] Received Answer (SDP length:', answerSdp.length, ')')
        
        // Log negotiated codecs for debugging
        const lines = answerSdp.split('\n')
        const rtpMaps = lines.filter(l => l.includes('a=rtpmap'))
        console.log('📡 [WHIP] Negotiated Codecs (Answer):', rtpMaps.join(' | '))
        
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: answerSdp
        }))
        
        console.log('✅ [WHIP] Handshake Complete (waiting for connection state to reach "connected")')
        
        // Track start time for monitoring
        const startTime = Date.now()
        
        // Add a monitor interval to ensure media stays flowing
        const monitorId = setInterval(async () => {
          if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
            console.error(`❌ [WHIP] Connection lost! State: ${pc.connectionState}`)
            clearInterval(monitorId)
          } else {
            // Check actual data transmission stats
            try {
              const stats = await pc.getStats()
              let videoBytesSent = 0
              let audioBytesSent = 0
              let videoPacketsSent = 0
              let audioPacketsSent = 0
              
              stats.forEach(report => {
                if (report.type === 'outbound-rtp') {
                  if (report.mediaType === 'video') {
                    videoBytesSent += report.bytesSent || 0
                    videoPacketsSent += report.packetsSent || 0
                  } else if (report.mediaType === 'audio') {
                    audioBytesSent += report.bytesSent || 0
                    audioPacketsSent += report.packetsSent || 0
                  }
                }
              })
              
              const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
              console.log(`📡 [WHIP] Connection Monitor (${elapsedSeconds}s): State=${pc.connectionState}, ICE=${pc.iceConnectionState}, Video=${(videoBytesSent/1024).toFixed(1)}KB (${videoPacketsSent} pkts), Audio=${(audioBytesSent/1024).toFixed(1)}KB (${audioPacketsSent} pkts)`)
              
              // Warn if no video data after 30 seconds
              if (videoBytesSent === 0 && elapsedSeconds > 30) {
                console.warn('⚠️ [WHIP] No video bytes sent after 30 seconds - browser may be throttling the stream! Keep the recorder tab visible and active.')
              }
            } catch (e) {
              const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
              console.log(`📡 [WHIP] Connection Monitor (${elapsedSeconds}s): State=${pc.connectionState}, ICE=${pc.iceConnectionState}`)
            }
          }
        }, 10000)

        return pc
      } catch (err) {
        console.error('❌ [WHIP] FATAL ERROR:', err)
        return null
      }
    }

    // Always check/create stream if streaming is enabled (even if we have streamId, we might need to reactivate)
    if (enableLiveStreaming && hasStreamingPermission && createStream && (currentGameIdRef.current || selectedGameId)) {
        // Check for recently stopped stream if no resumeStreamId provided
        let streamIdToResume = resumeStreamId
        if (!streamIdToResume && getRecentlyStoppedStream && (currentGameIdRef.current || selectedGameId)) {
          try {
             const gameId = currentGameIdRef.current || selectedGameId
            const stoppedStream = await getRecentlyStoppedStream(gameId)
            if (stoppedStream) {
              streamIdToResume = stoppedStream.id
              console.log('🔄 Found recently stopped stream to resume:', streamIdToResume)
            }
          } catch (err) {
            console.warn('Error checking for recently stopped stream:', err)
          }
        }
        
        // Always create/reactivate stream when restarting (even if we have an old whipUrl)
        // This ensures the stream is reactivated and the URL is updated
        try {
           const gameId = currentGameIdRef.current || selectedGameId
           console.log('🔄 Creating/reactivating live stream for game:', gameId, streamIdToResume ? '(resuming)' : '(new)')
           const streamData = await createStream(gameId, streamIdToResume)
               if (streamData) {
               setStreamId(streamData.id)
               // Use the game stream hub URL (shows all active streams for this game)
               const gameIdForUrl = currentGameIdRef.current || selectedGameId
               const appViewerUrl = gameIdForUrl
                 ? `${window.location.origin}/game/${gameIdForUrl}/streams`
                 : `${window.location.origin}/stream/${streamData.id}`
               setStreamUrl(appViewerUrl)
               if (organization?.id) {
                 setOrgStreamsUrl(`${window.location.origin}/org/${organization.id}/streams`)
               }
            if (streamData.rtmpsKey) {
              setRtmpsKey(streamData.rtmpsKey)
              setRtmpsUrl(streamData.rtmpsUrl || 'rtmps://global-live.mux.com:443/app')
            }
            // Clear recently stopped stream since we're resuming
             if (streamIdToResume) {
               setRecentlyStoppedStream(null)
             }
               
               // Keep the raw stream URL for internal use if needed, or just rely on ID
               whipUrlToUse = streamData.whipUrl
               whipUrlRef.current = streamData.whipUrl // Save to ref
             console.log('✅ Stream Created/Reactivated. Viewer URL:', appViewerUrl)
             }
          } catch (err) {
           console.error('❌ Failed to create/reactivate stream:', err)
        }
    }

    // Record start timestamp (CRITICAL for synchronization)
    const startTimestamp = new Date().toISOString()
    setRecordingStartTimestamp(startTimestamp)
    currentStartTimestampRef.current = startTimestamp // Store in ref immediately
    recordedBlobsRef.current = [] // Reset recorded blobs
    streamChunksRef.current = [] // Reset stream chunks
    streamChunkIndexRef.current = nextChunkIndex // Continue from next chunk index (or 0 if new stream)
    console.log('⏰ Start timestamp set:', startTimestamp)

    // START BROADCASTING IF WE HAVE WHIP URL
    if (whipUrlToUse) {
       console.log('📡 Found WHIP URL, initializing broadcast...')
       pushToWhip(whipUrlToUse, stream).then(pc => {
          // Store PC reference
          whipPeerConnectionRef.current = pc
          if (pc) {
             console.log('✅ WHIP PeerConnection established and sending.')
          } else {
             console.error('❌ WHIP PeerConnection failed to establish.')
          }
       })
    } else {
       console.warn('⚠️ No WHIP URL found - Streaming will not be live.')
    }

    // Determine best mimeType for MediaRecorder (prefer H264 for Cloudflare compatibility)
    let mimeType = 'video/webm;codecs=vp8,opus';
    const candidates = [
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=h264',
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus'
    ];
    
    for (const cand of candidates) {
      if (MediaRecorder.isTypeSupported(cand)) {
        mimeType = cand;
        break;
      }
    }
    console.log('🎬 Using MediaRecorder mimeType:', mimeType);

    // Create a new MediaRecorder (important for restarting after stop)
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
    })

    mediaRecorderRef.current = mediaRecorder
    
    // Ensure we're not already recording
    if (isRecordingRef.current) {
      console.warn('⚠️ Already recording, stopping first...')
      setIsRecording(false)
      isRecordingRef.current = false
    }

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        if (recordedBlobsRef.current.length === 0) {
          console.log('🎬 [RECORDER] First data packet produced! Size:', event.data.size)
        }
        
        // Store blob for final video
        recordedBlobsRef.current.push(event.data)
        
        // Update UI chunk display
        const chunkId = Date.now() + Math.random()
        const newChunk = {
          id: chunkId,
          size: event.data.size,
          timestamp: new Date(),
          status: 'recording',
        }
        setChunks((prev) => [...prev, newChunk])
        
        // For broadcasting: 
        // In WHIP mode, we push the stream directly from the browser (not chunks).
        // So we don't need to do anything here for streaming.
        // We'll wire up the WHIP client if you want live broadcasting from browser.
      }
    }

    mediaRecorder.onstop = async () => {
      // Final stop - user stopped recording
      // With timeslice, we don't need to handle segment stops here anymore
      console.log('🛑 Final recording stop')
      
      // Stop stream chunk interval (if it exists - not used with timeslice but kept for safety)
      if (streamChunkIntervalRef.current) {
        clearInterval(streamChunkIntervalRef.current)
        streamChunkIntervalRef.current = null
      }
      
      // Stop the stream
      if (streamId && stopStream) {
        try {
          await stopStream(streamId)
          console.log('🛑 Stream stopped')
        } catch (err) {
          console.error('Error stopping stream:', err)
        }
      }
      
      // Create final video blob
      const finalBlob = new Blob(recordedBlobsRef.current, { type: 'video/webm' })
      
      // Use the ref values which were captured when recording started
      const gameIdToUse = currentGameIdRef.current || selectedGameId
      const timestampToUse = currentStartTimestampRef.current || recordingStartTimestamp
      
      console.log('🛑 Recording stopped. Final blob size:', finalBlob.size, 'bytes')
      console.log('🛑 Checking save conditions:', {
        gameIdFromRef: currentGameIdRef.current,
        gameIdFromState: selectedGameId,
        gameIdToUse: gameIdToUse,
        timestampFromRef: currentStartTimestampRef.current,
        timestampFromState: recordingStartTimestamp,
        timestampToUse: timestampToUse,
        hasGameId: !!gameIdToUse,
        hasTimestamp: !!timestampToUse
      })
      
      // Save recording if game is selected
      if (gameIdToUse && timestampToUse) {
        console.log('✅ Conditions met, calling saveRecording with gameId:', gameIdToUse)
        await saveRecording(finalBlob, timestampToUse, gameIdToUse)
      } else {
        console.warn('⚠️ Cannot save recording - missing:', {
          gameId: gameIdToUse ? 'OK' : 'MISSING',
          timestamp: timestampToUse ? 'OK' : 'MISSING',
          gameIdFromRef: currentGameIdRef.current,
          gameIdFromState: selectedGameId
        })
        alert('Recording completed but cannot be saved. Please select an event (Game/Practice/Skills) before recording.')
      }
      
      // Clear the refs after saving
      currentGameIdRef.current = null
      currentStartTimestampRef.current = null
    }

    // Use timeslice to create segments without stopping/restarting
    // This eliminates gaps between segments for seamless streaming
    const SEGMENT_DURATION = 10000 // 10 seconds per segment
    
    // Start with timeslice to get data chunks every 10 seconds
    // This creates complete segments without stopping the recorder
    mediaRecorder.start(SEGMENT_DURATION)
    setIsRecording(true)
    isRecordingRef.current = true

    console.log('🎬 Started recording with timeslice segments (10s each)')

    // Request fullscreen when recording starts - use the container div
    if (videoContainerRef.current) {
      const containerElement = videoContainerRef.current
      if (containerElement.requestFullscreen) {
        containerElement.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err)
        })
      } else if (containerElement.webkitRequestFullscreen) {
        // Safari
        containerElement.webkitRequestFullscreen()
      } else if (containerElement.mozRequestFullScreen) {
        // Firefox
        containerElement.mozRequestFullScreen()
      } else if (containerElement.msRequestFullscreen) {
        // IE/Edge
        containerElement.msRequestFullscreen()
      }
    }
  }

  const saveRecording = async (videoBlob, startTimestamp, gameIdOverride = null) => {
    const gameIdToUse = gameIdOverride || selectedGameId
    
    console.log('💾 saveRecording called with:', {
      blobSize: videoBlob?.size,
      hasGameId: !!gameIdToUse,
      hasUserId: !!user?.id,
      gameId: gameIdToUse,
      gameIdOverride,
      selectedGameId,
      userId: user?.id
    })
    
    if (!gameIdToUse || !user?.id) {
      console.warn('❌ Cannot save recording: game or user not selected', {
        gameIdToUse,
        selectedGameId,
        userId: user?.id
      })
      return
    }

    try {
      const endTimestamp = new Date().toISOString()
      
      // Create thumbnail and get duration
      const { thumbnailUrl: thumbnailDataUrl, durationSeconds } = await createThumbnailAndDuration(videoBlob)

      // Upload video to Supabase Storage
      let videoUrl = null
      let thumbnailUrl = thumbnailDataUrl // Fallback to data URL if upload fails
      
      if (uploadVideoToStorage) {
        try {
          console.log('📤 Starting video upload process...')
          console.log('📤 Video blob details:', {
            size: videoBlob.size,
            type: videoBlob.type,
            gameId: gameIdToUse,
            userId: user.id
          })
          videoUrl = await uploadVideoToStorage(videoBlob, gameIdToUse, user.id)
          console.log('✅ Video uploaded successfully:', videoUrl)
        } catch (uploadError) {
          console.error('❌ Video upload failed with error:', uploadError)
          console.error('❌ Error details:', {
            message: uploadError?.message,
            name: uploadError?.name,
            stack: uploadError?.stack
          })
          // Fallback to blob URL if upload fails (for development/testing)
          console.warn('⚠️ Falling back to blob URL (video will not persist after refresh)')
          videoUrl = URL.createObjectURL(videoBlob)
        }
      } else {
        // Fallback if upload function not available
        console.warn('⚠️ uploadVideoToStorage function not available, using blob URL')
        videoUrl = URL.createObjectURL(videoBlob)
      }

      // Upload thumbnail to Supabase Storage (optional, won't fail if it errors)
      if (uploadThumbnailToStorage && thumbnailDataUrl) {
        try {
          console.log('📤 Uploading thumbnail to storage...')
          thumbnailUrl = await uploadThumbnailToStorage(thumbnailDataUrl, gameIdToUse, user.id)
          console.log('✅ Thumbnail uploaded:', thumbnailUrl)
        } catch (uploadError) {
          console.warn('⚠️ Thumbnail upload failed, using data URL:', uploadError)
          // Keep data URL as fallback
        }
      }

      // Get game start timestamp (combine game_date and game_time)
      const game = organization?.games?.find(g => g.id === gameIdToUse)
      let gameStartTimestamp = null
      if (game?.gameDate && game?.gameTime) {
        gameStartTimestamp = new Date(`${game.gameDate}T${game.gameTime}`).toISOString()
      }

      // Save to database (if addVideoRecording is available)
      if (addVideoRecording) {
        console.log('💾 Calling addVideoRecording with:', {
          gameId: gameIdToUse,
          hasVideoUrl: !!videoUrl,
          durationSeconds,
          hasThumbnail: !!thumbnailUrl,
          fileSize: videoBlob.size,
          recordingType: eventType === 'game' ? 'full_game' : 'custom'
        })
        
        const result = await addVideoRecording({
          gameId: gameIdToUse,
          videoUrl: videoUrl, // Now a Storage URL (or blob URL as fallback)
          durationSeconds: durationSeconds,
          thumbnailUrl: thumbnailUrl, // Storage URL or data URL
          fileSizeBytes: videoBlob.size,
          recordingStartTimestamp: startTimestamp,
          recordingEndTimestamp: endTimestamp,
          gameStartTimestamp: gameStartTimestamp,
          recordingType: eventType === 'game' ? 'full_game' : 'custom',
          description:
            eventType === 'practice'
              ? (eventNotes?.trim() ? `Practice: ${eventNotes.trim()}` : 'Practice')
              : eventType === 'skills'
                ? (eventNotes?.trim() ? `Skills: ${eventNotes.trim()}` : 'Skills')
                : (eventNotes?.trim() ? `Game: ${eventNotes.trim()}` : null)
        })
        
        if (result) {
          console.log('✅ Recording saved successfully to database:', result)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('icepulse:video-recorded', { detail: { gameId: gameIdToUse } })
            )
          }
      } else {
          console.error('❌ addVideoRecording returned null - video was NOT saved!')
          setError('Video recording failed to save to database. Please check console for details.')
        }
      } else {
        console.error('❌ Cannot save recording: addVideoRecording not available (not in OrgProvider)')
        setError('Cannot save recording: Organization context not available.')
      }
    } catch (error) {
      console.error('❌ Error saving recording:', error)
      setError(`Failed to save recording: ${error.message || 'Unknown error'}`)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      isRecordingRef.current = false
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current)
        chunkIntervalRef.current = null
      }
    }

    // Clear WHIP peer connection
    if (whipPeerConnectionRef.current) {
      try {
        whipPeerConnectionRef.current.close()
      } catch (e) {
        console.warn('Error closing WHIP connection:', e)
      }
      whipPeerConnectionRef.current = null
    }

    // Exit fullscreen when recording stops
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err)
      })
    } else if (document.webkitFullscreenElement) {
      document.webkitExitFullscreen()
    } else if (document.mozFullScreenElement) {
      document.mozCancelFullScreen()
    } else if (document.msFullscreenElement) {
      document.msExitFullscreen()
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Disable save until required fields are selected.
  // - Existing game: require a game selection.
  // - Manual game: require team + season + opponent.
  // - Practice/skills: require team + season.
  const canSaveEvent = (() => {
    if (!eventType) return false
    if (eventType === 'game' && !eventUseManualGame) {
      return !!eventExistingGameId
    }
    if (eventType === 'game') {
      return !!eventTeamId && !!eventSeasonId && !!eventOpponent.trim()
    }
    return !!eventTeamId && !!eventSeasonId
  })()

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900 text-white">
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-3 sm:p-4 lg:p-6">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0 gap-3">

        {/* Event Setup Modal */}
        {showEventModal && !isRecording && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-70 p-2 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-xl max-h-[95vh] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col my-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
                <div className="min-w-0 pr-2">
                  <h2 className="text-lg font-semibold">What are you recording?</h2>
                  <p className="text-sm text-gray-400">
                    Choose an event type before recording so the clip is categorized correctly.
                  </p>
                </div>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-300 flex-shrink-0"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                {(() => {
                  // Get today's date in local timezone
                  const today = new Date()
                  const todayYear = today.getFullYear()
                  const todayMonth = today.getMonth()
                  const todayDate = today.getDate()
                  
                  // Get all events (games, practices, skills) for today
                  const allEvents = organization?.games || []
                  const todayEvents = allEvents.filter(event => {
                    if (!event.gameDate) return false
                    const eventDateParts = event.gameDate.split('-')
                    if (eventDateParts.length === 3) {
                      const eventYear = parseInt(eventDateParts[0], 10)
                      const eventMonth = parseInt(eventDateParts[1], 10) - 1
                      const eventDay = parseInt(eventDateParts[2], 10)
                      return eventYear === todayYear && eventMonth === todayMonth && eventDay === todayDate
                    }
                    return false
                  })
                  
                  // Format time helper for display
                  const formatTimeForDisplay = (timeString) => {
                    if (!timeString) return ''
                    try {
                      const [hours, minutes] = timeString.split(':')
                      const hour = parseInt(hours)
                      const ampm = hour >= 12 ? 'PM' : 'AM'
                      const displayHour = hour % 12 || 12
                      return `${displayHour}:${minutes} ${ampm}`
                    } catch {
                      return timeString
                    }
                  }
                  
                  // Format event label
                  const formatEventLabel = (event) => {
                    const team = organization?.teams?.find(t => t.id === event.teamId)
                    const season = organization?.seasons?.find(s => s.id === event.seasonId)
                    const time = event.gameTime ? formatTimeForDisplay(event.gameTime) : ''
                    const eventType = event.eventType || 'game'
                    
                    if (eventType === 'game') {
                      const opponent = event.opponent ? ` vs ${event.opponent}` : ''
                      return `Game${opponent} - ${team?.name || 'Unknown'}${time ? ` @ ${time}` : ''}`
                    } else if (eventType === 'practice') {
                      return `Practice - ${team?.name || 'Unknown'}${time ? ` @ ${time}` : ''}`
                    } else if (eventType === 'skills') {
                      return `Skills - ${team?.name || 'Unknown'}${time ? ` @ ${time}` : ''}`
                    }
                    return `${team?.name || 'Unknown'}${time ? ` @ ${time}` : ''}`
                  }
                  
                  return (
                    <>
                      {/* Today's Events List */}
                      {todayEvents.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-gray-300 mb-2 text-sm font-semibold">Today's Events</label>
                          <div className="space-y-2 max-h-48 overflow-y-auto scrollable-container">
                            {todayEvents.map(event => {
                              const team = organization?.teams?.find(t => t.id === event.teamId)
                              const season = organization?.seasons?.find(s => s.id === event.seasonId)
                              const isGame = event.eventType === 'game'
                              const isPractice = event.eventType === 'practice'
                              const isSkills = event.eventType === 'skills'
                              
                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  onClick={() => {
                                    setEventType(event.eventType || 'game')
                                    if (isGame) {
                                      setEventExistingGameId(event.id)
                                      setEventUseManualGame(false)
                                      setEventTeamId(event.teamId)
                                      setEventSeasonId(event.seasonId)
                                    } else {
                                      // For practice/skills, also set the existing game ID to track selection
                                      setEventExistingGameId(event.id)
                                      setEventTeamId(event.teamId)
                                      setEventSeasonId(event.seasonId)
                                      setEventDate(event.gameDate)
                                      setEventTime(event.gameTime || '')
                                      setEventLocation(event.location || '')
                                      setEventNotes(event.notes || '')
                                    }
                                  }}
                                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                                    eventExistingGameId && event.id && String(eventExistingGameId) === String(event.id)
                                      ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                                      : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                                      isGame 
                                        ? 'bg-blue-900 bg-opacity-30'
                                        : isPractice
                                        ? 'bg-purple-900 bg-opacity-30'
                                        : 'bg-emerald-900 bg-opacity-30'
                                    }`}>
                                      {isGame ? (
                                        <Calendar className="w-5 h-5 text-blue-400" />
                                      ) : isPractice ? (
                                        <Dumbbell className="w-5 h-5 text-purple-400" />
                                      ) : (
                                        <Sparkles className="w-5 h-5 text-emerald-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-white truncate">
                                        {formatEventLabel(event)}
                                      </div>
                                      {team && season && (
                                        <div className="text-xs text-gray-400 truncate">
                                          {team.name} • {season.name}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          <div className="pt-2 border-t border-gray-800">
                            <p className="text-xs text-gray-400 text-center">Or select an event type below</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Event Type Selector - only show if no event type selected or no today's events */}
                      {(!eventType || todayEvents.length === 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { 
                      setEventType('game'); 
                      setEventUseManualGame(false); 
                      setEventExistingGameId(''); // Clear selection when switching to manual mode
                      setError(null) 
                    }}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      eventType === 'game'
                        ? 'border-blue-700 bg-blue-900 bg-opacity-20'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-blue-300" />
                      <span className="font-semibold">Game</span>
                    </div>
                    <p className="text-xs text-gray-400">Link to a scheduled game, or create one.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => { 
                      setEventType('practice'); 
                      setEventExistingGameId(''); // Clear selection when switching to manual mode
                      setError(null) 
                    }}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      eventType === 'practice'
                        ? 'border-purple-700 bg-purple-900 bg-opacity-20'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Dumbbell className="w-4 h-4 text-purple-300" />
                      <span className="font-semibold">Practice</span>
                    </div>
                    <p className="text-xs text-gray-400">Record a practice session for a team.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => { 
                      setEventType('skills'); 
                      setEventExistingGameId(''); // Clear selection when switching to manual mode
                      setError(null) 
                    }}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      eventType === 'skills'
                        ? 'border-emerald-700 bg-emerald-900 bg-opacity-20'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      <span className="font-semibold">Skills</span>
                    </div>
                    <p className="text-xs text-gray-400">Record skills/drills outside a game.</p>
                  </button>
                </div>
                      )}
                    </>
                  )
                })()}

                {eventType === 'game' && (() => {
                  const games = organization?.games || []
                  
                  return (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 mb-2 text-sm">Choose Existing Game</label>
                      {(() => {
                        console.log('🎮 Available games for dropdown:', {
                          gameCount: games.length,
                          games: games.map(g => ({ id: g.id, opponent: g.opponent, date: g.gameDate }))
                        })
                        return (
                      <Dropdown
                            options={games
                          .sort((a, b) => (a.gameDate || '').localeCompare(b.gameDate || ''))
                          .map(g => ({
                            value: g.id,
                            label: computeEventLabelFromGame(g)
                          }))}
                        value={eventExistingGameId}
                            onChange={(val) => { 
                              console.log('🎮 Game selected from dropdown:', val)
                              setEventExistingGameId(val)
                              setEventUseManualGame(false)
                              
                              // Populate team and season from selected game
                              const selectedGame = games.find(g => g.id === val)
                              if (selectedGame) {
                                console.log('🎮 Selected game data:', selectedGame)
                                // Use teamId or team_id (handle both naming conventions)
                                const teamId = selectedGame.teamId || selectedGame.team_id
                                const seasonId = selectedGame.seasonId || selectedGame.season_id
                                
                                if (teamId) {
                                  setEventTeamId(teamId)
                                  console.log('✅ Set team ID:', teamId)
                                }
                                if (seasonId) {
                                  setEventSeasonId(seasonId)
                                  console.log('✅ Set season ID:', seasonId)
                                }
                              }
                            }}
                            placeholder={games.length === 0 ? "No games available - create one manually" : "Select a game..."}
                        multiple={false}
                        showAllOption={false}
                        icon={<Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      />
                        )
                      })()}
                      {organization?.games?.length === 0 && (
                        <p className="text-xs text-yellow-400 mt-1">
                          No games found. Create games in the Schedule tab first, or create one manually below.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setEventUseManualGame(!eventUseManualGame)}
                        className="mt-2 text-xs text-blue-300 hover:text-blue-200"
                      >
                        {eventUseManualGame ? 'Use existing game instead' : `No game listed? Create one manually`}
                      </button>
                      
                      {/* Show team and season for selected game */}
                      {eventExistingGameId && !eventUseManualGame && (() => {
                        // Get the selected game to find team/season info
                        const selectedGame = games.find(g => g.id === eventExistingGameId)
                        const teamId = selectedGame?.teamId || selectedGame?.team_id
                        const seasonId = selectedGame?.seasonId || selectedGame?.season_id
                        
                        // Build team options: include available teams + the game's team if not in available
                        const teamOptions = [...availableTeams]
                        if (teamId && !teamOptions.find(t => t.id === teamId)) {
                          // Game's team is not in available teams - add it from the organization teams
                          const orgTeam = organization?.teams?.find(t => t.id === teamId)
                          if (orgTeam) {
                            teamOptions.push({ id: orgTeam.id, name: orgTeam.name })
                          }
                        }
                        
                        // Build season options: include available seasons + the game's season if not in available
                        const seasonOptions = [...availableSeasons]
                        if (seasonId && !seasonOptions.find(s => s.id === seasonId)) {
                          // Game's season is not in available seasons - add it from the organization seasons
                          const orgSeason = organization?.seasons?.find(s => s.id === seasonId)
                          if (orgSeason) {
                            seasonOptions.push({ id: orgSeason.id, name: orgSeason.name })
                          }
                        }
                        
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <div>
                              <label className="block text-gray-300 mb-2 text-sm">Team</label>
                              <Dropdown
                                options={teamOptions.map(t => ({ value: t.id, label: t.name }))}
                                value={eventTeamId || teamId}
                                onChange={() => {}} // Disabled - from selected game
                                placeholder="No team selected"
                                multiple={false}
                                showAllOption={false}
                                disabled={true}
                              />
                            </div>
                            <div>
                              <label className="block text-gray-300 mb-2 text-sm">Season/Tournament</label>
                              <Dropdown
                                options={seasonOptions.map(s => ({ value: s.id, label: s.name }))}
                                value={eventSeasonId || seasonId}
                                onChange={() => {}} // Disabled - from selected game
                                placeholder="No season selected"
                                multiple={false}
                                showAllOption={false}
                                disabled={true}
                              />
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {eventUseManualGame && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-300 mb-2 text-sm">Date</label>
                            <input
                              type="date"
                              value={eventDate}
                              onChange={(e) => setEventDate(e.target.value)}
                              className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-300 mb-2 text-sm">Time (Optional)</label>
                            <input
                              type="time"
                              value={eventTime}
                              onChange={(e) => setEventTime(e.target.value)}
                              className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-300 mb-2 text-sm">Team (Required)</label>
                            <Dropdown
                              options={availableTeams.map(t => ({ value: t.id, label: t.name }))}
                              value={eventTeamId}
                              onChange={setEventTeamId}
                              placeholder={availableTeams.length === 0 ? "No teams available" : "Select team..."}
                              multiple={false}
                              showAllOption={false}
                            />
                            {availableTeams.length === 0 && (
                              <p className="text-xs text-yellow-400 mt-1">
                                No teams found. You need to be assigned to a team first.
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-gray-300 mb-2 text-sm">Season/Tournament (Required)</label>
                            <Dropdown
                              options={availableSeasons.map(s => ({ value: s.id, label: s.name }))}
                              value={eventSeasonId}
                              onChange={setEventSeasonId}
                              placeholder={availableSeasons.length === 0 ? "No seasons available" : "Select season..."}
                              multiple={false}
                              showAllOption={false}
                            />
                            {availableSeasons.length === 0 && (
                              <p className="text-xs text-yellow-400 mt-1">
                                No seasons found. You need to be assigned to a season first.
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-300 mb-2 text-sm">Opponent (Required)</label>
                          <input
                            value={eventOpponent}
                            onChange={(e) => setEventOpponent(e.target.value)}
                            placeholder="Opponent name"
                            className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Later we can add a merge flow if the organization enters the same game separately.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-300 mb-2 text-sm">Location (Optional)</label>
                            <input
                              value={eventLocation}
                              onChange={(e) => setEventLocation(e.target.value)}
                              placeholder="e.g., Main Rink"
                              className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-300 mb-2 text-sm">Notes (Optional)</label>
                            <input
                              value={eventNotes}
                              onChange={(e) => setEventNotes(e.target.value)}
                              placeholder="Optional notes"
                              className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })()}

                {(eventType === 'practice' || eventType === 'skills') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-300 mb-2 text-sm">Date</label>
                        <input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2 text-sm">Time (Optional)</label>
                        <input
                          type="time"
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-300 mb-2 text-sm">Team (Required)</label>
                        <Dropdown
                          options={availableTeams.map(t => ({ value: t.id, label: t.name }))}
                          value={eventTeamId}
                          onChange={setEventTeamId}
                          placeholder={availableTeams.length === 0 ? "No teams available" : "Select team..."}
                          multiple={false}
                          showAllOption={false}
                        />
                        {availableTeams.length === 0 && (
                          <p className="text-xs text-yellow-400 mt-1">
                            No teams found. You need to be assigned to a team first.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2 text-sm">Season/Tournament (Required)</label>
                        <Dropdown
                          options={availableSeasons.map(s => ({ value: s.id, label: s.name }))}
                          value={eventSeasonId}
                          onChange={setEventSeasonId}
                          placeholder={availableSeasons.length === 0 ? "No seasons available" : "Select season..."}
                          multiple={false}
                          showAllOption={false}
                        />
                        {availableSeasons.length === 0 && (
                          <p className="text-xs text-yellow-400 mt-1">
                            No seasons found. You need to be assigned to a season first.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-300 mb-2 text-sm">Location (Optional)</label>
                        <input
                          value={eventLocation}
                          onChange={(e) => setEventLocation(e.target.value)}
                          placeholder="e.g., Main Rink"
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2 text-sm">Notes (Optional)</label>
                        <input
                          value={eventNotes}
                          onChange={(e) => setEventNotes(e.target.value)}
                          placeholder="Optional notes"
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming Toggle - Show when user has permission and required fields are filled */}
                {hasStreamingPermission && eventType && selectedGameId && (
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={enableLiveStreaming}
                        onChange={async (e) => {
                          const nextValue = e.target.checked
                          setEnableLiveStreaming(nextValue)
                          if (!nextValue) {
                            setShowLarixModal(false)
                            setHasCopiedBroadcastId(false)
                            setRtmpsComboCopied(false)
                          } else {
                            await ensureStreamForLiveToggle()
                            if (isMobileDevice()) {
                            setShowLarixModal(true)
                            }
                          }
                        }}
                        disabled={!eventTeamId || !eventSeasonId}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        id="enable-streaming"
                      />
                      <div className="flex-1">
                        <label htmlFor="enable-streaming" className="text-white cursor-pointer">
                          Enable Live Streaming
                        </label>
                        <p className="text-xs text-gray-400 mt-1">
                          Stream this recording live. Viewers can watch in real-time at the provided URL.
                        </p>
                        {(!eventTeamId || !eventSeasonId) && (
                          <p className="text-xs text-yellow-400 mt-1">
                            Select a team and season to enable live streaming.
                          </p>
                        )}
                        {enableLiveStreaming && isMobileDevice() && (
                          <button
                            type="button"
                            onClick={() => setShowLarixModal(true)}
                            className="mt-2 text-xs text-blue-300 hover:text-blue-200"
                          >
                            Show Larix setup again
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stream URL Section - Show after event is saved and stream is created - Positioned prominently */}
                {orgStreamsUrl && (
                  <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-2 border-blue-500/50 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-blue-300 font-semibold mb-2 text-sm flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        Organization Live Streams URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={orgStreamsUrl}
                          readOnly
                          className="flex-1 bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700 text-sm font-mono"
                          onClick={(e) => e.target.select()}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(orgStreamsUrl)
                            setUrlCopied(true)
                            setTimeout(() => setUrlCopied(false), 2000)
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center gap-2 flex-shrink-0"
                          title="Copy URL"
                        >
                          {urlCopied ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span className="hidden sm:inline">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span className="hidden sm:inline">Copy</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            const message = `Watch live streams: ${orgStreamsUrl}`
                            if (navigator.share) {
                              navigator.share({
                                title: 'Live Streams',
                                text: message,
                                url: orgStreamsUrl
                              }).catch(() => {
                                // Fallback to SMS
                                window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank')
                              })
                            } else {
                              // Fallback to SMS
                              window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank')
                            }
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors flex items-center gap-2 flex-shrink-0"
                          title="Share via SMS/Message"
                        >
                          <Share2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Share</span>
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Share this URL with families - it always shows all live streams.
                      </p>
                    </div>
                  </div>
                )}

                {rtmpsUrl && rtmpsKey && (
                  <div className="bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 border border-emerald-500/40 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-emerald-300 font-semibold mb-2 text-sm">
                        Mux RTMPS (Use Larix/OBS)
                      </label>
                      <p className="text-xs text-emerald-200/80">
                        Use the Larix popup to copy the combined URL for easier setup.
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-800 flex items-center justify-between gap-3 flex-shrink-0">
                  <button
                    onClick={() => {
                      setShowEventModal(false)
                    setError(null)
                    }}
                    className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                  Cancel
                  </button>
                {selectedGameId ? (
                  // If event is selected, show red "Record" button that immediately starts recording
                    <button
                    onClick={async () => {
                      // Close modal first
                      setShowEventModal(false)
                      // Immediately start recording - will go full screen
                      if (stream && !isRecording) {
                        // Use requestAnimationFrame to ensure modal is closed before starting recording
                        requestAnimationFrame(() => {
                          startRecording()
                        })
                      }
                    }}
                    disabled={!stream || !selectedGameId || isRecording}
                    className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold text-base"
                  >
                    {streamUrl ? '🔴 Record & Stream' : '🔴 Record'}
                    </button>
                ) : (
                  // If no event selected yet, show "Save" button that creates event (and stream if enabled)
                    <button
                    onClick={async () => {
                      const success = await ensureEventSelected()
                      if (success) {
                        // Modal stays open - stream URL will appear and button will change to "Record"
                      }
                    }}
                    disabled={isCreatingEvent || !canSaveEvent}
                    className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold"
                  >
                    {isCreatingEvent ? 'Saving…' : 'Save'}
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}

        {showLarixModal && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black bg-opacity-70 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-gray-800 space-y-3">
                <h3 className="text-lg font-bold text-white">Go Live from Your Phone</h3>
                <p className="text-sm text-gray-400">
                  Mux live streams require an RTMP broadcaster app (Larix recommended).
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={async () => {
                      if (!rtmpsKey) return
                      const baseUrl = rtmpsUrl || 'rtmps://global-live.mux.com:443/app'
                      const combined = baseUrl.endsWith('/')
                        ? `${baseUrl}${rtmpsKey}`
                        : `${baseUrl}/${rtmpsKey}`
                      const didCopy = await copyTextToClipboard(combined)
                      if (!didCopy) return
                      setRtmpsComboCopied(true)
                      setHasCopiedBroadcastId(true)
                      setTimeout(() => setRtmpsComboCopied(false), 2000)
                    }}
                    disabled={!rtmpsKey || isCreatingStream}
                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold text-base transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {isCreatingStream ? 'Generating...' : rtmpsComboCopied ? 'Copied!' : 'Copy Broadcast ID'}
                  </button>
                  <button
                    onClick={() => setShowLarixModal(false)}
                    disabled={!hasCopiedBroadcastId}
                    className="flex-1 px-4 py-3 rounded-lg font-semibold text-base transition-colors disabled:bg-gray-700 disabled:text-gray-400 bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed"
                  >
                    Go Live
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4 text-sm text-gray-200">
                <div className="space-y-2">
                  <p className="font-semibold text-white">Step-by-step (Larix)</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-300">
                    <li>Open Larix and tap the + to add a new connection.</li>
                    <li>Name the connection (e.g., "IcePulse Live").</li>
                    <li>Tap Settings → Connection, then paste the combined RTMPS URL below.</li>
                    <li>Save, then tap Start to go live.</li>
                  </ol>
                </div>
                {rtmpsUrl && rtmpsKey && (
                  <div className="bg-gray-950/70 border border-gray-700 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-300 uppercase tracking-wide">RTMPS URL/Stream Key</span>
                      <button
                        onClick={async () => {
                          const baseUrl = rtmpsUrl || 'rtmps://global-live.mux.com:443/app'
                          const combined = baseUrl.endsWith('/')
                            ? `${baseUrl}${rtmpsKey}`
                            : `${baseUrl}/${rtmpsKey}`
                          const didCopy = await copyTextToClipboard(combined)
                          if (!didCopy) return
                          setRtmpsComboCopied(true)
                          setTimeout(() => setRtmpsComboCopied(false), 2000)
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold transition-colors"
                      >
                        {rtmpsComboCopied ? 'Copied!' : 'Copy Both'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={(rtmpsUrl || 'rtmps://global-live.mux.com:443/app').endsWith('/')
                        ? `${rtmpsUrl || 'rtmps://global-live.mux.com:443/app'}${rtmpsKey}`
                        : `${rtmpsUrl || 'rtmps://global-live.mux.com:443/app'}/${rtmpsKey}`}
                      readOnly
                      className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700 text-xs font-mono"
                      onClick={(e) => e.target.select()}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Don’t have Larix to broadcast?</p>
                  <a
                    href={getLarixStoreLink()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                  >
                    Get Larix Broadcaster
                  </a>
                </div>
              </div>
              <div className="p-4 border-t border-gray-800 flex justify-end">
                <button
                  onClick={() => setShowLarixModal(false)}
                  className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Layout: Video on top, Controls below (desktop) or stacked (mobile) */}
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Video Preview Section - Full width, fits to width, height adjusts to aspect ratio */}
          <div className="flex-shrink-0 flex flex-col w-full">
            <div 
              ref={videoContainerRef}
              className={`bg-gray-800 rounded-xl ${isRecording ? 'p-0' : 'p-2'} shadow-2xl relative flex-shrink-0 w-full ${isRecording ? 'fixed inset-0 z-50 bg-black rounded-none' : ''}`}
            >
              <div className={`relative bg-black ${isRecording ? 'w-full h-full' : 'rounded-lg overflow-hidden w-full'} ${!isRecording ? 'flex items-center justify-center' : ''}`} style={!isRecording ? { height: '50vh', maxHeight: '50vh' } : {}}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`${isRecording ? 'w-full h-full' : 'w-full h-auto max-h-full'} object-contain ${isRecording ? 'rounded-none' : ''}`}
                  style={{ transform: 'scaleX(-1)' }}
                />
                
                {!stream && !isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-center px-4">
                      {isRequesting ? (
                        <>
                          <Video className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-600" />
                          <p className="text-gray-400 text-sm sm:text-base">Requesting camera access...</p>
                        </>
                      ) : error ? (
                        <>
                          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-red-500" />
                          <p className="text-red-400 mb-2 font-semibold text-sm sm:text-base">Permission Denied</p>
                          <p className="text-gray-400 text-xs sm:text-sm mb-4">{error}</p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                              onClick={requestMediaAccess}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors text-sm sm:text-base"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Retry
                            </button>
                            <button
                              onClick={() => setShowHelp(true)}
                              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors text-sm sm:text-base"
                            >
                              <HelpCircle className="w-4 h-4" />
                              How to Enable
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <Video className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-600" />
                          <p className="text-gray-400 text-sm sm:text-base">No camera access</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Recording Indicator - Full screen mode */}
              {isRecording && (
                <>
                  {/* Top left: Camera swap button */}
                  {cameras.length > 1 && (
                    <div className="absolute top-4 left-4 z-[100] pointer-events-auto">
                      {isMobile ? (
                        <button
                          onClick={flipCamera}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 hover:bg-gray-800/90 rounded-lg text-white text-sm font-semibold backdrop-blur-sm transition-all shadow-md border border-gray-700/50"
                          title={facingMode === 'environment' ? 'Switch to Front Camera' : 'Switch to Back Camera'}
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden sm:inline">
                            {facingMode === 'environment' ? 'Front' : 'Back'}
                          </span>
                        </button>
                      ) : (
                        <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-md">
                          <Dropdown
                            options={cameras.map((camera) => ({
                              value: camera.deviceId,
                              label: camera.label || `Camera ${cameras.indexOf(camera) + 1}`,
                            }))}
                            value={selectedCameraId || ''}
                            onChange={(cameraId) => switchCamera(cameraId)}
                            placeholder="Camera..."
                            multiple={false}
                            showAllOption={false}
                            disabled={false}
                            icon={<Camera className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Top right corner: REC indicator and Share button */}
                <div className="absolute top-4 right-4 z-[100] flex items-center gap-2 pointer-events-none">
                    <div className="flex items-center gap-2 bg-black bg-opacity-80 px-3 py-2 rounded-lg backdrop-blur-sm">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </div>
                      <span className="text-white text-base font-bold">REC</span>
                    </div>
                    
                    {/* Share button while recording */}
                    {streamUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(streamUrl)
                          setUrlCopied(true)
                          setTimeout(() => setUrlCopied(false), 2000)
                        }}
                        className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-blue-600 bg-opacity-90 hover:bg-opacity-100 rounded-lg text-white text-sm font-semibold backdrop-blur-sm transition-all shadow-md"
                      >
                        {urlCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                        <span>{urlCopied ? 'Copied!' : 'Share Stream'}</span>
                      </button>
                    )}
                  </div>

                  {/* Bottom center: Large Stop Recording Button */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-auto">
                  <button
                    onClick={stopRecording}
                      className="flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-lg sm:text-xl transition-all shadow-2xl border-2 border-red-400 text-white transform hover:scale-105 active:scale-95"
                  >
                      <Square className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                    <span>Stop Recording</span>
                  </button>
                </div>
                </>
              )}

              {/* Not Recording Indicator - Show when preview is active but not recording */}
              {!isRecording && stream && (
                <div className="absolute top-4 left-4 z-[100] pointer-events-none">
                  <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                      <span className="text-gray-300 text-sm font-medium">Preview</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls Section - Centered below video, scrollable with hidden scrollbar */}
              {!isRecording && (
            <div className="flex-1 flex flex-col items-center gap-2 min-h-0 overflow-y-auto hide-scrollbar pb-2">
              <div className="w-full max-w-2xl flex flex-col gap-2 flex-shrink-0">
                {/* Event Summary Card */}
                <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 shadow-lg">
                  <div className="flex flex-col items-center gap-3 mb-2">
                    <div className="w-full text-center">
                      <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Selected Event</p>
                      <p className="text-base text-white font-semibold">
                          {eventSummary || (selectedGameId ? 'Event selected' : 'No event selected')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEventModal(true)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500 transition-colors"
                      >
                        Change
                      </button>
                    </div>
                    {!selectedGameId && (
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed text-center">
                      Choose an event before recording to categorize your clip correctly.
                      </p>
                    )}
                  </div>

                {/* Stream URL Card - Only show when streaming */}
                {streamUrl && (
                  <div className="bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-blue-900/40 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 shadow-lg">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </div>
                      <label className="text-blue-300 font-semibold text-sm">Live Stream URL</label>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={streamUrl}
                        readOnly
                        className="flex-1 bg-gray-900/80 text-white px-3 py-2 rounded-lg border border-gray-700/50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        onClick={(e) => e.target.select()}
                      />
                    <button
                        onClick={() => {
                          navigator.clipboard.writeText(streamUrl)
                          setUrlCopied(true)
                          setTimeout(() => setUrlCopied(false), 2000)
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center gap-2 flex-shrink-0 text-sm shadow-md"
                        title="Copy URL"
                      >
                        {urlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span className="hidden sm:inline">{urlCopied ? 'Copied!' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={() => {
                          const message = `Watch the live stream: ${streamUrl}`
                          if (navigator.share) {
                            navigator.share({
                              title: 'Live Stream',
                              text: message,
                              url: streamUrl
                            }).catch(() => {
                              window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank')
                            })
                          } else {
                            window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank')
                          }
                        }}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors flex items-center gap-2 flex-shrink-0 text-sm shadow-md"
                        title="Share Stream"
                      >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Share</span>
                    </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed text-center">
                      Share this URL with viewers - no login required!
                    </p>
                  </div>
                  )}
              </div>

              {/* Camera, Audio, and Recording Controls - Centered */}
              <div className="w-full max-w-2xl flex flex-col gap-3">
                {/* Resume Recording Card */}
                {recentlyStoppedStream && selectedGameId && (
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4 shadow-lg">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-300 mb-1">Resume Previous Recording</p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Continue recording to the same stream link.
                        </p>
                      </div>
                      <button
                        onClick={() => startRecording(recentlyStoppedStream.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors text-sm shadow-md flex-shrink-0"
                      >
                        <Video className="w-4 h-4" />
                        <span>Resume</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Camera & Audio Controls Card - Always visible */}
                <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 shadow-lg">
                  <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide text-center">Settings</p>
                  <div className="flex flex-col gap-3">
                      {/* Camera Controls */}
                    {cameras.length > 1 && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-2 text-center">Camera</label>
                        {isMobile ? (
                          <button
                            onClick={flipCamera}
                            disabled={isRecording}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-sm"
                            title={facingMode === 'environment' ? 'Currently: Back Camera - Click to switch to Front' : 'Currently: Front Camera - Click to switch to Back'}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Switch to {facingMode === 'environment' ? 'Front' : 'Back'}</span>
                          </button>
                        ) : (
                          <Dropdown
                            options={cameras.map((camera) => ({
                              value: camera.deviceId,
                              label: camera.label || `Camera ${cameras.indexOf(camera) + 1}`,
                            }))}
                            value={selectedCameraId || ''}
                            onChange={(cameraId) => switchCamera(cameraId)}
                            placeholder="Select camera..."
                            multiple={false}
                            showAllOption={false}
                            disabled={isRecording}
                            icon={<Camera className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                          />
                        )}
                        </div>
                    )}

                      {/* Audio Toggle */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2 text-center">Audio</label>
                      <button
                        onClick={toggleAudio}
                        disabled={!stream}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm shadow-md ${
                          audioEnabled
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        } ${!stream ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!stream ? 'Camera must be active to toggle audio' : (audioEnabled ? 'Disable audio recording' : 'Enable audio recording')}
                      >
                        {audioEnabled ? (
                          <>
                            <Mic className="w-4 h-4" />
                            <span>Audio On</span>
                          </>
                        ) : (
                          <>
                            <MicOff className="w-4 h-4" />
                            <span>Audio Off</span>
                          </>
                        )}
                      </button>
                    </div>
            </div>
          </div>

                {/* Event Selection Prompt */}
                {!selectedGameId && (
                  <button
                    onClick={() => setShowEventModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition-colors text-sm shadow-lg"
                  >
                    <Calendar className="w-5 h-5" />
                    <span>Select Event to Record</span>
                  </button>
                )}

                {/* Start Recording Button - Large, prominent */}
                {selectedGameId && stream && !isRecording && (
                  <button
                    onClick={async () => {
                      // Check for recently stopped stream to reuse the same URL
                      let resumeId = null
                      if (getRecentlyStoppedStream && selectedGameId) {
                        try {
                          const stoppedStream = await getRecentlyStoppedStream(selectedGameId)
                          if (stoppedStream) {
                            resumeId = stoppedStream.id
                            console.log('🔄 Found recently stopped stream, will reuse:', resumeId)
                          }
                        } catch (err) {
                          console.warn('Error checking for recently stopped stream:', err)
                        }
                      }
                      startRecording(resumeId)
                    }}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-bold text-base sm:text-lg transition-all shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span>Start Recording{streamUrl ? ' & Streaming' : ''}</span>
                  </button>
                )}
                  </div>
                </div>
              )}
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-blue-400" />
                How to Enable Camera & Microphone Access
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Chrome / Edge */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <span className="text-blue-400">🌐</span>
                  Chrome / Edge / Brave
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
                  <li>Click the <strong className="text-white">lock icon</strong> or <strong className="text-white">camera icon</strong> in the address bar</li>
                  <li>Find <strong className="text-white">Camera</strong> and <strong className="text-white">Microphone</strong> in the permissions list</li>
                  <li>Change both to <strong className="text-green-400">Allow</strong></li>
                  <li>Refresh the page or click <strong className="text-blue-400">Retry</strong></li>
                </ol>
                <p className="mt-3 text-xs text-gray-400">
                  Alternative: Go to <strong className="text-white">Settings → Privacy and security → Site Settings → Camera/Microphone</strong>
                </p>
              </div>

              {/* Firefox */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <span className="text-orange-400">🦊</span>
                  Firefox
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
                  <li>Click the <strong className="text-white">lock icon</strong> in the address bar</li>
                  <li>Click <strong className="text-white">More Information</strong></li>
                  <li>Go to the <strong className="text-white">Permissions</strong> tab</li>
                  <li>Set <strong className="text-white">Use the Camera</strong> and <strong className="text-white">Use the Microphone</strong> to <strong className="text-green-400">Allow</strong></li>
                  <li>Refresh the page or click <strong className="text-blue-400">Retry</strong></li>
                </ol>
              </div>

              {/* Safari */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <span className="text-blue-300">🧭</span>
                  Safari
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
                  <li>Go to <strong className="text-white">Safari → Settings → Websites</strong></li>
                  <li>Select <strong className="text-white">Camera</strong> and find this website</li>
                  <li>Set it to <strong className="text-green-400">Allow</strong></li>
                  <li>Repeat for <strong className="text-white">Microphone</strong></li>
                  <li>Refresh the page or click <strong className="text-blue-400">Retry</strong></li>
                </ol>
                <p className="mt-3 text-xs text-gray-400">
                  Or: When prompted, click <strong className="text-green-400">Allow</strong> in the browser popup
                </p>
              </div>

              {/* Mobile */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <span className="text-purple-400">📱</span>
                  Mobile Devices
                </h3>
                <div className="space-y-3 text-gray-300 text-sm">
                  <div>
                    <strong className="text-white">iOS (Safari):</strong>
                    <p className="mt-1">Go to <strong className="text-white">Settings → Safari → Camera/Microphone</strong> and ensure permissions are enabled. Then allow when prompted in Safari.</p>
                  </div>
                  <div>
                    <strong className="text-white">Android (Chrome):</strong>
                    <p className="mt-1">Go to <strong className="text-white">Settings → Apps → Chrome → Permissions</strong> and enable Camera & Microphone. Or allow when prompted in the browser.</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  <strong className="text-blue-200">💡 Tip:</strong> After enabling permissions, click the <strong className="text-white">Retry</strong> button above to request access again.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default VideoRecorder
