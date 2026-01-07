import { useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { Building2, Save } from 'lucide-react'

function OrgSetup() {
  const { organization, updateOrganization } = useOrg()
  const [orgName, setOrgName] = useState(organization?.name || '')
  const [saved, setSaved] = useState(false)

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

      <div className="space-y-4 max-w-2xl">
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
