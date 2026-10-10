import React, { useState } from 'react';
import { Address } from '../../types';
import { MapPin, Navigation, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AddressFormFieldsProps {
  value: Omit<Address, 'id' | 'userId'>;
  onChange: (next: Omit<Address, 'id' | 'userId'>) => void;
  onNotify?: (title: string, message?: string, type?: 'success' | 'info' | 'error') => void;
  showLabelSelector?: boolean;
}

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
];

export const AddressFormFields: React.FC<AddressFormFieldsProps> = ({
  value,
  onChange,
  onNotify,
  showLabelSelector = true,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLookingUpPin, setIsLookingUpPin] = useState(false);

  const handleFieldChange = (patch: Partial<Omit<Address, 'id' | 'userId'>>) => {
    const merged = { ...value, ...patch };
    // Sync legacy fields (`name`, `street`, `zipCode`) with rich fields (`fullName`, `houseNo`, `area`, `pincode`)
    if (patch.fullName !== undefined) {
      merged.name = patch.fullName;
    } else if (patch.name !== undefined) {
      merged.fullName = patch.name;
    }

    if (patch.pincode !== undefined) {
      merged.zipCode = patch.pincode;
    } else if (patch.zipCode !== undefined) {
      merged.pincode = patch.zipCode;
    }

    // Build a clean combined street string for backward compatibility
    const parts = [
      merged.houseNo?.trim(),
      merged.street?.trim(),
      merged.area?.trim(),
      merged.landmark ? `Near ${merged.landmark.trim()}` : '',
    ].filter(Boolean);

    if (parts.length > 0 && (patch.houseNo !== undefined || patch.area !== undefined || patch.landmark !== undefined)) {
      // Keep street as the road/building name if user typed it separately, or ensure street is non-empty
      if (!merged.street?.trim()) {
        merged.street = [merged.houseNo, merged.area].filter(Boolean).join(', ');
      }
    }

    onChange(merged);
  };

  // Auto-lookup Indian PIN code via api.postalpincode.in
  const handlePincodeChange = async (rawPin: string) => {
    const cleanPin = rawPin.replace(/\D/g, '').slice(0, 6);
    handleFieldChange({ zipCode: cleanPin, pincode: cleanPin });

    if (cleanPin.length === 6) {
      setIsLookingUpPin(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
        const data = await res.json();
        if (Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0]?.PostOffice) && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0];
          const detectedCity = po.Block && po.Block !== 'NA' ? po.Block : po.District || value.city;
          const detectedDistrict = po.District || value.district || '';
          const detectedState = po.State || value.state;
          const detectedArea = value.area || po.Name || '';

          handleFieldChange({
            zipCode: cleanPin,
            pincode: cleanPin,
            city: detectedCity || value.city,
            district: detectedDistrict,
            state: detectedState || value.state,
            area: detectedArea,
            country: 'India',
          });
        }
      } catch {
        // Ignore lookup error; user can type manually
      } finally {
        setIsLookingUpPin(false);
      }
    }
  };

  // Use Current Location (Browser Geolocation + Nominatim Reverse Geocoding)
  const handleDetectLocation = () => {
    setLocationError(null);
    setLocationSuccess(null);

    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser. Please enter your address manually.';
      setLocationError(msg);
      onNotify?.('Location Unavailable', msg, 'error');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en',
              },
            }
          );

          if (!response.ok) {
            throw new Error('Reverse geocoding service unavailable');
          }

          const data = await response.json();
          const addr = data?.address || {};

          const houseNo = addr.house_number || addr.building || value.houseNo || '';
          const road = addr.road || addr.pedestrian || addr.street || value.street || '';
          const area =
            addr.suburb ||
            addr.neighbourhood ||
            addr.residential ||
            addr.village ||
            addr.hamlet ||
            addr.quarter ||
            value.area ||
            '';
          const city =
            addr.city ||
            addr.town ||
            addr.municipality ||
            addr.county ||
            addr.state_district ||
            value.city ||
            '';
          const district = addr.state_district || addr.county || city || value.district || '';
          const state = addr.state || value.state || '';
          const pincode = (addr.postcode || value.zipCode || '').replace(/\s+/g, '');
          const country = addr.country || 'India';

          const nextStreet = road || area || data?.display_name?.split(',').slice(0, 2).join(', ') || value.street;

          onChange({
            ...value,
            houseNo: houseNo || value.houseNo || '',
            street: nextStreet,
            area: area || value.area || '',
            city: city || value.city,
            district: district || value.district || '',
            state: state || value.state,
            zipCode: pincode || value.zipCode,
            pincode: pincode || value.pincode || value.zipCode,
            country,
            latitude: lat,
            longitude: lng,
          });

          setLocationSuccess(
            `Location detected (${lat}, ${lng}) — please verify House/Flat number and Landmark.`
          );
          onNotify?.('Location Autofilled', 'Your current delivery address has been filled. You can edit any field.', 'success');
        } catch {
          // Even if reverse geocoding fails, save the GPS coordinates
          onChange({
            ...value,
            latitude: lat,
            longitude: lng,
          });
          setLocationSuccess(`GPS coordinates captured (${lat}, ${lng}). Please complete the address fields below.`);
          onNotify?.('GPS Captured', 'Coordinates saved. Please fill in your street and PIN code.', 'info');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        let msg = 'Unable to retrieve your location. Please enter your address manually.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access or enter your address manually.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Please try again or type your address manually.';
        }
        setLocationError(msg);
        onNotify?.('Location Permission', msg, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Use Current Location Banner Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-gradient-to-r from-violet-50/90 via-indigo-50/60 to-violet-50/90 border border-violet-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block">Quick GPS Address Autofill</span>
            <span className="text-[11px] text-slate-500 block">
              Auto-detect your street, area, city, state & PIN code using device GPS
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={isLocating}
          className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          {isLocating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Detecting Location...</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5" />
              <span>Use Current Location</span>
            </>
          )}
        </button>
      </div>

      {/* Status Alerts */}
      {locationSuccess && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{locationSuccess}</span>
        </div>
      )}

      {locationError && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Row 1: Full Name & Phone Number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={value.fullName ?? value.name ?? ''}
            onChange={(e) => handleFieldChange({ fullName: e.target.value, name: e.target.value })}
            placeholder="Receiver's full name"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Mobile Number (10-digit) <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            required
            value={value.phone ?? ''}
            onChange={(e) => handleFieldChange({ phone: e.target.value })}
            placeholder="9876543210"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>
      </div>

      {/* Row 2: Alternate Phone & Email (Optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Alternate Phone <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="tel"
            value={value.alternatePhone ?? ''}
            onChange={(e) => handleFieldChange({ alternatePhone: e.target.value })}
            placeholder="Alternate contact number"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Email for Order Updates <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="email"
            value={value.email ?? ''}
            onChange={(e) => handleFieldChange({ email: e.target.value })}
            placeholder="customer@email.com"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>
      </div>

      {/* Row 3: House/Flat/Building No. & Road/Street */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            House / Flat / Building No. <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={value.houseNo ?? ''}
            onChange={(e) => handleFieldChange({ houseNo: e.target.value })}
            placeholder="Flat 402, Sunshine Residency"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Street / Road / Colony <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={value.street ?? ''}
            onChange={(e) => handleFieldChange({ street: e.target.value })}
            placeholder="MG Road, Sector 14"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>
      </div>

      {/* Row 4: Area/Locality & Landmark */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Area / Locality / Sector <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={value.area ?? ''}
            onChange={(e) => handleFieldChange({ area: e.target.value })}
            placeholder="Indiranagar / Connaught Place"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Landmark <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={value.landmark ?? ''}
            onChange={(e) => handleFieldChange({ landmark: e.target.value })}
            placeholder="Near Metro Station / City Mall"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>
      </div>

      {/* Row 5: PIN Code, City, District, State */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            PIN Code (6-digit) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              value={value.zipCode ?? value.pincode ?? ''}
              onChange={(e) => handlePincodeChange(e.target.value)}
              placeholder="560038"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
            {isLookingUpPin && (
              <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin absolute right-2.5 top-2.5" />
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            City / Town <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={value.city ?? ''}
            onChange={(e) => handleFieldChange({ city: e.target.value })}
            placeholder="Bengaluru"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            District
          </label>
          <input
            type="text"
            value={value.district ?? ''}
            onChange={(e) => handleFieldChange({ district: e.target.value })}
            placeholder="District"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            State <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            list="indian-states-list"
            value={value.state ?? ''}
            onChange={(e) => handleFieldChange({ state: e.target.value })}
            placeholder="State"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
          <datalist id="indian-states-list">
            {INDIAN_STATES.map((st) => (
              <option key={st} value={st} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Row 6: Delivery Instructions & Address Type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className={showLabelSelector ? 'sm:col-span-2' : 'sm:col-span-3'}>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Delivery Instructions <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={value.deliveryInstructions ?? ''}
            onChange={(e) => handleFieldChange({ deliveryInstructions: e.target.value })}
            placeholder="e.g. Leave at security gate or call before arriving"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        {showLabelSelector && (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Address Label</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => handleFieldChange({ label: lbl })}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    value.label === lbl
                      ? 'border-violet-600 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Display captured GPS badge if present */}
      {value.latitude !== undefined && value.longitude !== undefined && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-100 text-[11px] text-slate-600">
          <span className="font-mono">
            GPS Pin: {value.latitude}, {value.longitude}
          </span>
          <a
            href={`https://www.google.com/maps?q=${value.latitude},${value.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 hover:underline font-semibold"
          >
            Preview on Map &rarr;
          </a>
        </div>
      )}
    </div>
  );
};
