import { useState, useEffect, useRef } from 'react'
import { Mail, CheckCircle, RefreshCw, X } from 'lucide-react'

/**
 * Reusable invite button component
 * @param {Function} onSendInvite - Function to call when sending invite
 * @param {Function} onResendInvite - Function to call when resending invite
 * @param {boolean} inviteSent - Whether invite has been sent
 * @param {string} inviteDate - ISO date string of when invite was sent
 * @param {string} email - Email address (required to send invite)
 * @param {string} className - Additional CSS classes
 */
function InviteButton({ onSendInvite, onResendInvite, inviteSent, inviteDate, email, className = '' }) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const confirmationRef = useRef(null)

  // Auto-close confirmation after 5 seconds
  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => {
        setShowConfirmation(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showConfirmation])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (confirmationRef.current && !confirmationRef.current.contains(event.target)) {
        setShowConfirmation(false)
      }
    }

    if (showConfirmation) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showConfirmation])

  const handleClick = async () => {
    if (!email || !email.trim()) {
      return // Don't proceed if no email
    }

    setLoading(true)
    setSuccess(false)

    try {
      let result
      if (inviteSent && onResendInvite) {
        result = await onResendInvite()
      } else if (onSendInvite) {
        result = await onSendInvite()
      }
      
      if (result && result.success !== false) {
        setSuccess(true)
        setShowConfirmation(true)
        setTimeout(() => setSuccess(false), 2000)
      } else {
        // Error message would be handled by the parent component
        console.error('Error sending invite:', result?.message || 'Unknown error')
      }
    } catch (error) {
      console.error('Error sending invite:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const hasEmail = email && email.trim().length > 0
  const isDisabled = loading || !hasEmail

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        title={!hasEmail ? 'Email address required to send invite' : ''}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
          inviteSent
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Sending...</span>
          </>
        ) : success ? (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>Sent!</span>
          </>
        ) : inviteSent ? (
          <>
            <Mail className="w-4 h-4" />
            <span>Resend Invite</span>
          </>
        ) : (
          <>
            <Mail className="w-4 h-4" />
            <span>Send Invite</span>
          </>
        )}
      </button>
      {inviteSent && inviteDate && (
        <span className="text-xs text-gray-400">
          Sent: {formatDate(inviteDate)}
        </span>
      )}

      {/* Confirmation Popup */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            ref={confirmationRef}
            className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-900 bg-opacity-50 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  {inviteSent ? 'Invite Resent!' : 'Invite Sent!'}
                </h3>
              </div>
              <button
                onClick={() => setShowConfirmation(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <p className="text-gray-300">
                An invitation email has been sent to:
              </p>
              <p className="text-blue-400 font-semibold break-all">
                {email}
              </p>
              <p className="text-sm text-gray-400">
                The recipient will receive an email with instructions to join the platform.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InviteButton
