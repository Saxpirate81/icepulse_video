import { useState, useRef, useEffect } from 'react'
import { Video, Square, Upload, CheckCircle, Clock, AlertCircle, RefreshCw, HelpCircle, X, Mic, MicOff, Camera, Calendar, Sparkles, Dumbbell, Copy, Share2, Check } from 'lucide-react'
import Dropdown from './Dropdown'
import { useAuth } from '../context/AuthContext'
import { useOrgOptional } from '../context/OrgContext'

function VideoRecorder() {
  const orgContext = useOrgOptional()
  const organization = orgContext?.organization || null
  const addVideoRecording = orgContext?.addVideoRecording || null
  const addGame = orgContext?.addGame || null
  const uploadVideoToStorage = orgContext?.uploadVideoToStorage || null
  const uploadThumbnailToStorage = orgContext?.uploadThumbnailToStorage || null
  const createStream = orgContext?.createStream || null
  const uploadStreamChunk = orgContext?.uploadStreamChunk || null
  const stopStream = orgContext?.stopStream || null
  const { user } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [chunks, setChunks] = useState([])
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [isRequesting, setIsRequesting] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
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
  const videoRef = useRef(null)
  const videoContainerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunkIntervalRef = useRef(null)
  const streamRef = useRef(null)
  const isRecordingRef = useRef(false)
  const recordedBlobsRef = useRef([])
  const currentGameIdRef = useRef(null) // Store gameId for the current recording session
  const currentStartTimestampRef = useRef(null) // Store start timestamp for the current recording session
  const [streamId, setStreamId] = useState(null)
  const [streamUrl, setStreamUrl] = useState(null)
  const [urlCopied, setUrlCopied] = useState(false)
  const streamChunkIndexRef = useRef(0)
  const streamChunkIntervalRef = useRef(null)
  const streamChunksRef = useRef([]) // Store chunks for streaming

  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      // Find built-in camera (usually has "built-in" or "FaceTime" in the label, or is the first one)
      let defaultCamera = null
      if (videoDevices.length > 0) {
        // Try to find built-in camera by label
        defaultCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('built-in') ||
          device.label.toLowerCase().includes('facetime') ||
          device.label.toLowerCase().includes('integrated')
        ) || videoDevices[0] // Fallback to first camera
        
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

  const requestMediaAccess = async (cameraId = null) => {
    setIsRequesting(true)
    setError(null)
    
    // Stop existing stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    try {
      // Always request audio initially to get permission, then we can toggle it
      const constraints = {
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
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

  const toggleAudio = () => {
    if (!streamRef.current) return
    
    const audioTracks = streamRef.current.getAudioTracks()
    const newAudioState = !audioEnabled
    
    audioTracks.forEach(track => {
      track.enabled = newAudioState
    })
    
    setAudioEnabled(newAudioState)
  }

  useEffect(() => {
    requestMediaAccess()

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

  const computeEventLabelFromGame = (game) => {
    if (!game) return ''
    const date = game.gameDate ? new Date(game.gameDate) : null
    const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No Date'
    const timeStr = game.gameTime ? game.gameTime.slice(0, 5) : ''
    const team = organization?.teams?.find(t => t.id === game.teamId)
    const vs = game.opponent || ''
    return `${dateStr}${timeStr ? ` ${timeStr}` : ''} — ${team?.name || 'Team'} vs ${vs}`
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

    if (!organization?.id || !addGame) {
      setError('Event setup requires organization access.')
      return false
    }

    // All new events require team+season due to DB constraints
    const requireTeamSeason = (teamId, seasonId) => {
      if (!teamId) return 'Please select a team.'
      if (!seasonId) return 'Please select a season/tournament.'
      return null
    }

    if (eventType === 'game' && !eventUseManualGame && eventExistingGameId) {
      // Set both state and ref immediately
      setSelectedGameId(eventExistingGameId)
      currentGameIdRef.current = eventExistingGameId
      const g = organization?.games?.find(x => x.id === eventExistingGameId)
      setEventSummary(g ? computeEventLabelFromGame(g) : 'Game selected')
      
      // Create stream for this game
      if (createStream) {
        try {
          console.log('🔄 Creating stream for game:', eventExistingGameId)
          const streamData = await createStream(eventExistingGameId)
          console.log('✅ Stream created:', streamData)
          if (streamData?.id && streamData?.streamUrl) {
            setStreamId(streamData.id)
            setStreamUrl(streamData.streamUrl)
            console.log('✅ Stream URL set:', streamData.streamUrl)
          } else {
            console.error('❌ Stream data incomplete:', streamData)
            setError('Stream created but URL not available. You can still record.')
            setShowEventModal(false)
          }
          // Keep modal open so user can see/copy the stream URL
        } catch (err) {
          console.error('❌ Error creating stream:', err)
          setError(`Stream creation failed: ${err.message || 'Please ensure the stream tables are set up in Supabase.'}`)
          // Still close modal to allow recording
          setShowEventModal(false)
        }
      } else {
        console.warn('⚠️ createStream function not available from OrgContext')
        setError('Streaming not available. Recording will still work.')
        setShowEventModal(false)
      }
      console.log('✅ Existing game selected, gameId set:', eventExistingGameId)
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
      const created = await addGame({
        teamId: eventTeamId,
        seasonId: eventSeasonId,
        gameDate: eventDate,
        gameTime: eventTime || null,
        opponent,
        location: eventLocation?.trim() || null,
        notes: eventNotes?.trim() || (eventType === 'practice' ? 'Practice recording' : eventType === 'skills' ? 'Skills recording' : 'Game created from recorder')
      })

      if (!created?.id) {
        setError('Failed to create event. Please try again.')
        return false
      }

      // Set both state and ref immediately
      setSelectedGameId(created.id)
      currentGameIdRef.current = created.id
      setEventSummary(`${eventType === 'game' ? 'Game' : eventType === 'practice' ? 'Practice' : 'Skills'} — ${created.gameDate} ${created.gameTime || ''}`.trim())
      
      // Create stream for this game
      if (createStream) {
        try {
          console.log('🔄 Creating stream for new game:', created.id)
          const streamData = await createStream(created.id)
          console.log('✅ Stream created:', streamData)
          if (streamData?.id && streamData?.streamUrl) {
            setStreamId(streamData.id)
            setStreamUrl(streamData.streamUrl)
            console.log('✅ Stream URL set:', streamData.streamUrl)
          } else {
            console.error('❌ Stream data incomplete:', streamData)
            setError('Stream created but URL not available. You can still record.')
            setShowEventModal(false)
          }
          // Keep modal open so user can see/copy the stream URL
        } catch (err) {
          console.error('❌ Error creating stream:', err)
          setError(`Stream creation failed: ${err.message || 'Please ensure the stream tables are set up in Supabase.'}`)
          // Still close modal to allow recording
          setShowEventModal(false)
        }
      } else {
        console.warn('⚠️ createStream function not available from OrgContext')
        setError('Streaming not available. Recording will still work.')
        setShowEventModal(false)
      }
      console.log('✅ Event created and gameId set:', created.id)
      return true
    } catch (e) {
      console.error('Error creating event:', e)
      setError('Failed to create event. Please try again.')
      return false
    } finally {
      setIsCreatingEvent(false)
    }
  }

  const startRecording = async () => {
    if (!stream) return
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
    
    console.log('🎬 Starting recording with gameId:', currentGameIdRef.current, 'state gameId:', selectedGameId)

    // Record start timestamp (CRITICAL for synchronization)
    const startTimestamp = new Date().toISOString()
    setRecordingStartTimestamp(startTimestamp)
    currentStartTimestampRef.current = startTimestamp // Store in ref immediately
    recordedBlobsRef.current = [] // Reset recorded blobs
    streamChunksRef.current = [] // Reset stream chunks
    streamChunkIndexRef.current = 0 // Reset chunk index
    console.log('⏰ Start timestamp set:', startTimestamp)

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8,opus',
    })

    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        // Store blob for final video
        recordedBlobsRef.current.push(event.data)
        
        // Store chunk for streaming
        const chunkBlob = event.data
        streamChunksRef.current.push(chunkBlob)
        
        // Upload chunk for streaming if stream is active
        if (streamId && uploadStreamChunk && streamChunksRef.current.length > 0) {
          const chunkIndex = streamChunkIndexRef.current++
          const chunkToUpload = streamChunksRef.current.shift() // Remove first chunk from queue
          
          try {
            await uploadStreamChunk(chunkToUpload, streamId, chunkIndex)
            console.log(`📤 Stream chunk ${chunkIndex} uploaded`)
          } catch (err) {
            console.error('Error uploading stream chunk:', err)
            // Re-add chunk to queue on failure
            streamChunksRef.current.unshift(chunkToUpload)
          }
        }
        
        // Update UI chunk display
        const chunkId = Date.now() + Math.random()
        const newChunk = {
          id: chunkId,
          size: event.data.size,
          timestamp: new Date(),
          status: 'uploading',
        }
        setChunks((prev) => [...prev, newChunk])

        // Simulate upload completion after 1-3 seconds (for UI only)
        setTimeout(() => {
          setChunks((prev) =>
            prev.map((chunk) =>
              chunk.id === chunkId
                ? { ...chunk, status: 'completed' }
                : chunk
            )
          )
        }, 1000 + Math.random() * 2000)
      }
    }

    mediaRecorder.onstop = async () => {
      // Stop stream chunk interval
      if (streamChunkIntervalRef.current) {
        clearInterval(streamChunkIntervalRef.current)
        streamChunkIntervalRef.current = null
      }
      
      // Upload any remaining stream chunks
      if (streamId && uploadStreamChunk && streamChunksRef.current.length > 0) {
        while (streamChunksRef.current.length > 0) {
          const chunkToUpload = streamChunksRef.current.shift()
          const chunkIndex = streamChunkIndexRef.current++
          try {
            await uploadStreamChunk(chunkToUpload, streamId, chunkIndex)
            console.log(`📤 Final stream chunk ${chunkIndex} uploaded`)
          } catch (err) {
            console.error('Error uploading final stream chunk:', err)
          }
        }
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

    // Use 7 second intervals - gives more time for upload and smoother playback
    mediaRecorder.start(7000)
    setIsRecording(true)
    isRecordingRef.current = true

    // Request data every 7 seconds for streaming chunks (more upload time = smoother)
    chunkIntervalRef.current = setInterval(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData()
      }
    }, 7000)

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
        await addVideoRecording({
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
        console.log('✅ Recording saved successfully to database')
      } else {
        console.warn('Cannot save recording: addVideoRecording not available (not in OrgProvider)')
      }
    } catch (error) {
      console.error('❌ Error saving recording:', error)
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {!isRecording && (
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 lg:mb-8 text-center">Video Recorder</h1>
        )}

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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { setEventType('game'); setEventUseManualGame(false); setError(null) }}
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
                    onClick={() => { setEventType('practice'); setError(null) }}
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
                    onClick={() => { setEventType('skills'); setError(null) }}
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

                {eventType === 'game' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 mb-2 text-sm">Choose Existing Game</label>
                      <Dropdown
                        options={(organization?.games || [])
                          .sort((a, b) => (a.gameDate || '').localeCompare(b.gameDate || ''))
                          .map(g => ({
                            value: g.id,
                            label: computeEventLabelFromGame(g)
                          }))}
                        value={eventExistingGameId}
                        onChange={(val) => { setEventExistingGameId(val); setEventUseManualGame(false) }}
                        placeholder="Select a game..."
                        multiple={false}
                        showAllOption={false}
                        icon={<Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      />
                      <button
                        type="button"
                        onClick={() => setEventUseManualGame(!eventUseManualGame)}
                        className="mt-2 text-xs text-blue-300 hover:text-blue-200"
                      >
                        {eventUseManualGame ? 'Use existing game instead' : `No game listed? Create one manually`}
                      </button>
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
                              options={(organization?.teams || []).map(t => ({ value: t.id, label: t.name }))}
                              value={eventTeamId}
                              onChange={setEventTeamId}
                              placeholder="Select team..."
                              multiple={false}
                              showAllOption={false}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-300 mb-2 text-sm">Season/Tournament (Required)</label>
                            <Dropdown
                              options={(organization?.seasons || []).map(s => ({ value: s.id, label: s.name }))}
                              value={eventSeasonId}
                              onChange={setEventSeasonId}
                              placeholder="Select season..."
                              multiple={false}
                              showAllOption={false}
                            />
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
                )}

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
                          options={(organization?.teams || []).map(t => ({ value: t.id, label: t.name }))}
                          value={eventTeamId}
                          onChange={setEventTeamId}
                          placeholder="Select team..."
                          multiple={false}
                          showAllOption={false}
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2 text-sm">Season/Tournament (Required)</label>
                        <Dropdown
                          options={(organization?.seasons || []).map(s => ({ value: s.id, label: s.name }))}
                          value={eventSeasonId}
                          onChange={setEventSeasonId}
                          placeholder="Select season..."
                          multiple={false}
                          showAllOption={false}
                        />
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

                {/* Stream URL Section */}
                {streamUrl && (
                  <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-blue-300 font-semibold mb-2 text-sm">
                        🔴 Live Stream URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={streamUrl}
                          readOnly
                          className="flex-1 bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700 text-sm font-mono"
                          onClick={(e) => e.target.select()}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(streamUrl)
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
                            const message = `Watch the live stream: ${streamUrl}`
                            if (navigator.share) {
                              navigator.share({
                                title: 'Live Stream',
                                text: message,
                                url: streamUrl
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
                        Share this URL with viewers - no login required to watch!
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
                <div className="text-xs text-gray-500">
                  Tip: You can change this later from the Recorder screen.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowEventModal(false)
                      // If stream URL exists, we still allow closing to proceed to recording
                    }}
                    className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    {streamUrl ? 'Start Recording' : 'Cancel'}
                  </button>
                  {!streamUrl && (
                    <button
                      onClick={ensureEventSelected}
                      disabled={isCreatingEvent}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold"
                    >
                      {isCreatingEvent ? 'Saving…' : 'Continue'}
                    </button>
                  )}
                  {streamUrl && (
                    <button
                      onClick={() => setShowEventModal(false)}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-semibold"
                    >
                      Start Recording
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Video Preview Section */}
          <div className="lg:col-span-2">
            <div 
              ref={videoContainerRef}
              className={`bg-gray-800 rounded-lg ${isRecording ? 'p-0' : 'p-4 sm:p-6'} shadow-xl relative ${isRecording ? 'fixed inset-0 z-50 bg-black rounded-none' : ''}`}
            >
              <div className={`relative bg-black ${isRecording ? 'w-full h-full' : 'rounded-lg overflow-hidden aspect-video'} ${!isRecording && 'mb-4 sm:mb-6'}`}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`${isRecording ? 'w-full h-full object-contain' : 'w-full h-full object-cover'} ${isRecording ? 'rounded-none' : ''}`}
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
              
              {/* Recording Indicator - Blinking Dot - Positioned relative to container */}
              {isRecording && (
                <div className="absolute top-4 right-4 z-[100] flex items-center gap-2 pointer-events-none">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-white text-sm font-semibold bg-black bg-opacity-70 px-2 py-1 rounded backdrop-blur-sm">REC</span>
                </div>
              )}

              {/* Stop Recording Button - Only visible during recording - Positioned relative to container */}
              {isRecording && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-auto">
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 bg-opacity-90 hover:bg-opacity-100 backdrop-blur-sm rounded-lg font-semibold transition-all shadow-lg border border-red-400 text-white"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span>Stop Recording</span>
                  </button>
                </div>
              )}

              {/* Start Recording Button and Controls - Only visible when not recording */}
              {!isRecording && (
                <>
                  {/* Event Summary */}
                  <div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">Selected event</p>
                        <p className="text-sm text-white font-medium truncate">
                          {eventSummary || (selectedGameId ? 'Event selected' : 'No event selected')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEventModal(true)}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-700"
                      >
                        Change
                      </button>
                    </div>
                    {!selectedGameId && (
                      <p className="text-xs text-gray-500 mt-2">
                        Choose Game, Practice, or Skills before recording so the clip is categorized correctly.
                      </p>
                    )}
                  </div>

                  {/* Start Recording Button */}
                  <div className="flex justify-center gap-4 mb-4">
                    <button
                      onClick={startRecording}
                      disabled={!stream || isCreatingEvent || !selectedGameId}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors text-sm sm:text-base"
                    >
                      <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>{isCreatingEvent ? 'Preparing…' : 'Start Recording'}</span>
                    </button>
                  </div>

                  {/* Camera and Audio Controls - Side by Side */}
                  {stream && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-center">
                      {/* Camera Selection */}
                      {cameras.length > 1 && (
                        <div className="flex-1 max-w-xs w-full sm:w-auto">
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
                            icon={<Camera className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />}
                          />
                        </div>
                      )}

                      {/* Audio Toggle */}
                      <button
                        onClick={toggleAudio}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                          audioEnabled
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        } ${cameras.length > 1 ? '' : 'w-full sm:w-auto'}`}
                        title={audioEnabled ? 'Disable audio recording' : 'Enable audio recording'}
                      >
                        {audioEnabled ? (
                          <>
                            <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>Audio On</span>
                          </>
                        ) : (
                          <>
                            <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>Audio Off</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Debug Panel - Hidden during recording on mobile */}
          <div className={`lg:col-span-1 ${isRecording ? 'hidden lg:block' : ''}`}>
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-semibold">Upload Chunks</h2>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {chunks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No chunks yet</p>
                    <p className="text-sm mt-1">Start recording to see chunks</p>
                  </div>
                ) : (
                  chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {chunk.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          )}
                          <span className="font-mono text-sm text-gray-300">
                            Chunk #{chunk.id.toString().slice(-6)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatTime(chunk.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {formatBytes(chunk.size)}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            chunk.status === 'completed'
                              ? 'text-green-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {chunk.status === 'completed' ? 'Uploaded' : 'Uploading...'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {chunks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Chunks:</span>
                    <span className="font-semibold">{chunks.length}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-400">Completed:</span>
                    <span className="font-semibold text-green-400">
                      {chunks.filter((c) => c.status === 'completed').length}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
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
  )
}

export default VideoRecorder
