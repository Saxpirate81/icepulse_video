import { useState, useEffect, useRef } from 'react'
import { useOrg } from '../context/OrgContext'
import { Building2, Save, Upload, X, Image as ImageIcon } from 'lucide-react'

function OrgSetup() {
  const { organization, updateOrganization, uploadHeaderImage } = useOrg()
  const [orgName, setOrgName] = useState(organization?.name || '')
  const [headerImageUrl, setHeaderImageUrl] = useState(organization?.headerImageUrl || '')
  const [headerImagePreview, setHeaderImagePreview] = useState(organization?.headerImageUrl || '')
  const [isUploading, setIsUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || '')
      setHeaderImageUrl(organization.headerImageUrl || '')
      setHeaderImagePreview(organization.headerImageUrl || '')
    }
  }, [organization])

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    setIsUploading(true)
    try {
      // Show preview immediately
      const reader = new FileReader()
      reader.onloadend = () => {
        setHeaderImagePreview(reader.result)
      }
      reader.readAsDataURL(file)

      // Upload to storage
      const uploadedUrl = await uploadHeaderImage(file)
      if (uploadedUrl) {
        setHeaderImageUrl(uploadedUrl)
        setHeaderImagePreview(uploadedUrl)
        // Auto-save the image URL
        await updateOrganization({ headerImageUrl: uploadedUrl })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        alert('Failed to upload image. Please try again.')
        setHeaderImagePreview(headerImageUrl) // Revert preview
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Error uploading image. Please try again.')
      setHeaderImagePreview(headerImageUrl) // Revert preview
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    setHeaderImageUrl('')
    setHeaderImagePreview('')
    await updateOrganization({ headerImageUrl: '' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSave = () => {
    updateOrganization({ name: orgName })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold">Organization Setup</h2>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-gray-300 mb-2">Organizational Name</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter organization name"
          />
        </div>

        <div>
          <label className="block text-gray-300 mb-2">Streaming Overlay Header Image</label>
          <p className="text-sm text-gray-400 mb-3">
            Upload an image to display in the header of your live streams. Recommended size: 1920x200px or similar wide format.
          </p>
          
          <div className="space-y-3">
            {headerImagePreview ? (
              <div className="relative">
                <img
                  src={headerImagePreview}
                  alt="Header preview"
                  className="w-full h-32 object-contain bg-gray-900 rounded-lg border border-gray-700"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-500 transition-colors"
              >
                <ImageIcon className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 mb-1">Click to upload header image</p>
                <p className="text-xs text-gray-500">PNG, JPG, or GIF up to 5MB</p>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            {!headerImagePreview && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploading ? 'Uploading...' : 'Choose Image'}</span>
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Save className="w-5 h-5" />
          <span>{saved ? 'Saved!' : 'Save Organization Name'}</span>
        </button>
      </div>
    </div>
  )
}

export default OrgSetup
