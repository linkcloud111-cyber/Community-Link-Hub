import { useState, useRef, useEffect } from "react";
import {
  X,
  User,
  Calendar,
  Phone,
  MapPin,
  Camera,
  Save,
  Loader2,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation as useAppLocation } from "@/contexts/LocationContext";
import {
  formatFullName,
  validateFullName,
  validateDob,
  extract10DigitMobile,
  validateIndianMobile,
  validateProfileLocation,
  validateProfileDetails,
} from "@/lib/utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import type { UserProfile } from "@/lib/types";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=250",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=250",
];

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
}

export function EditProfileModal({ isOpen, onClose, profile, onSave }: EditProfileModalProps) {
  const { activeStates, getDistrictsForState } = useAppLocation();

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");

  // Touch / Interaction tracking
  const [nameTouched, setNameTouched] = useState(false);
  const [dobTouched, setDobTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [stateTouched, setStateTouched] = useState(false);
  const [districtTouched, setDistrictTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const [bioTouched, setBioTouched] = useState(false);
  const [photoTouched, setPhotoTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync state when modal opens or profile changes
  useEffect(() => {
    if (profile) {
      setFullName(formatFullName(profile.displayName || ""));
      setDob(profile.dob || "");
      setPhotoURL(profile.photoURL || "");
      setPhone(extract10DigitMobile(profile.phone || ""));
      setSelectedState(profile.state || "");
      setSelectedDistrict(profile.district || "");
      setCity(profile.city || "");
      setAddress(profile.address || "");
      setBio(profile.bio || "");

      setNameTouched(false);
      setDobTouched(false);
      setPhoneTouched(false);
      setStateTouched(false);
      setDistrictTouched(false);
      setCityTouched(false);
      setAddressTouched(false);
      setBioTouched(false);
      setPhotoTouched(false);
      setSubmitAttempted(false);
    }
  }, [profile, isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentDistricts = selectedState ? getDistrictsForState(selectedState).map((d) => d.name) : [];

  // ─── 1. Full Name Validation ──────────────────────────────────────────────
  const normalizedName = formatFullName(fullName.trim());
  const nameValidation = validateFullName(normalizedName);
  const isNameInteractive = nameTouched || submitAttempted;
  const nameState: "neutral" | "valid" | "invalid" = !fullName.trim()
    ? isNameInteractive
      ? "invalid"
      : "neutral"
    : nameValidation.valid
    ? "valid"
    : "invalid";
  const nameErrorMessage =
    nameState === "invalid"
      ? !fullName.trim()
        ? "Full name is required."
        : nameValidation.error || "Full Name must contain at least 3 letters."
      : null;

  // ─── 2. Date of Birth Validation (Age >= 18) ──────────────────────────────
  const dobValidation = validateDob(dob);
  const isDobInteractive = dobTouched || submitAttempted;
  const dobState: "neutral" | "valid" | "invalid" = !dob.trim()
    ? isDobInteractive
      ? "invalid"
      : "neutral"
    : dobValidation.valid
    ? "valid"
    : "invalid";
  const dobErrorMessage =
    dobState === "invalid"
      ? !dob.trim()
        ? "Date of birth is required."
        : dobValidation.error || "You must be at least 18 years old."
      : null;

  // ─── 3. Mobile Number Validation (10 digits Indian) ───────────────────────
  const phoneValidation = validateIndianMobile(phone);
  const isPhoneInteractive = phoneTouched || submitAttempted;
  const phoneState: "neutral" | "valid" | "invalid" = !phone.trim()
    ? isPhoneInteractive
      ? "invalid"
      : "neutral"
    : phoneValidation.valid
    ? "valid"
    : "invalid";
  const phoneErrorMessage =
    phoneState === "invalid"
      ? !phone.trim()
        ? "Mobile number is required."
        : phoneValidation.error || "Please enter a valid 10-digit Indian mobile number."
      : null;

  // ─── 4, 5, 6. Location Validation (State, District, City) ─────────────────
  const locationValidation = validateProfileLocation(selectedState, selectedDistrict, city);
  
  const isStateInteractive = stateTouched || submitAttempted;
  const stateState: "neutral" | "valid" | "invalid" = !selectedState.trim() || selectedState === "Select State"
    ? isStateInteractive
      ? "invalid"
      : "neutral"
    : "valid";
  const stateErrorMessage = stateState === "invalid" ? "State is required." : null;

  const isDistrictInteractive = districtTouched || submitAttempted;
  const districtState: "neutral" | "valid" | "invalid" =
    !selectedDistrict.trim() || selectedDistrict === "Select District"
      ? isDistrictInteractive
        ? "invalid"
        : "neutral"
      : "valid";
  const districtErrorMessage = districtState === "invalid" ? "District is required." : null;

  const isCityInteractive = cityTouched || submitAttempted;
  const cityState: "neutral" | "valid" | "invalid" = !city.trim()
    ? isCityInteractive
      ? "invalid"
      : "neutral"
    : city.trim().length >= 2
    ? "valid"
    : "invalid";
  const cityErrorMessage =
    cityState === "invalid"
      ? !city.trim()
        ? "City/Town is required."
        : "City/Town must be at least 2 characters."
      : null;

  // ─── 7, 8, 9. Details Validation (Address, Bio, Photo) ────────────────────
  const detailsValidation = validateProfileDetails(address, bio, photoURL);

  const isAddressInteractive = addressTouched || submitAttempted;
  const addressState: "neutral" | "valid" | "invalid" = !address.trim()
    ? isAddressInteractive
      ? "invalid"
      : "neutral"
    : address.trim().length >= 3
    ? "valid"
    : "invalid";
  const addressErrorMessage =
    addressState === "invalid"
      ? !address.trim()
        ? "Address/Area is required."
        : "Address/Area must be at least 3 characters."
      : null;

  const isBioInteractive = bioTouched || submitAttempted;
  const bioState: "neutral" | "valid" | "invalid" = !bio.trim()
    ? isBioInteractive
      ? "invalid"
      : "neutral"
    : bio.trim().length >= 5
    ? "valid"
    : "invalid";
  const bioErrorMessage =
    bioState === "invalid"
      ? !bio.trim()
        ? "Bio/About You is required."
        : "Bio/About You must be at least 5 characters."
      : null;

  const isPhotoInteractive = photoTouched || submitAttempted;
  const photoState: "neutral" | "valid" | "invalid" = !photoURL.trim()
    ? isPhotoInteractive
      ? "invalid"
      : "neutral"
    : "valid";
  const photoErrorMessage = photoState === "invalid" ? "Profile image is required." : null;

  // ─── Overall Form Validity ────────────────────────────────────────────────
  const isFormValid =
    nameValidation.valid &&
    dobValidation.valid &&
    phoneValidation.valid &&
    locationValidation.valid &&
    detailsValidation.valid;

  const getFieldBorderClass = (state: "neutral" | "valid" | "invalid") => {
    if (state === "invalid") {
      return "border-rose-500 ring-1 ring-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-slate-900 dark:text-white";
    }
    if (state === "valid") {
      return "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10 text-slate-900 dark:text-white";
    }
    return "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white";
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB.");
      return;
    }

    setUploadingImage(true);
    setPhotoTouched(true);
    try {
      const url = await uploadToCloudinary(file, "linkcloud");
      setPhotoURL(url);
      toast.success("Profile photo uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploadingImage) return;

    setSubmitAttempted(true);
    setNameTouched(true);
    setDobTouched(true);
    setPhoneTouched(true);
    setStateTouched(true);
    setDistrictTouched(true);
    setCityTouched(true);
    setAddressTouched(true);
    setBioTouched(true);
    setPhotoTouched(true);

    // 1. Full Name
    const cleanName = formatFullName(fullName.trim());
    const nameCheck = validateFullName(cleanName);
    if (!nameCheck.valid) {
      toast.error(nameCheck.error || "Full Name is required.");
      return;
    }

    // 2. Date of Birth
    const dobCheck = validateDob(dob.trim());
    if (!dobCheck.valid) {
      toast.error(dobCheck.error || "Date of birth is required.");
      return;
    }

    // 3. Indian Mobile
    const phoneCheck = validateIndianMobile(phone.trim());
    if (!phoneCheck.valid) {
      toast.error(phoneCheck.error || "Mobile number is required.");
      return;
    }

    // 4, 5, 6. Location
    const locCheck = validateProfileLocation(selectedState, selectedDistrict, city);
    if (!locCheck.valid) {
      const firstLocErr = locCheck.errors.state || locCheck.errors.district || locCheck.errors.city;
      toast.error(firstLocErr || "Please complete all location fields.");
      return;
    }

    // 7, 8, 9. Details
    const detailsCheck = validateProfileDetails(address, bio, photoURL);
    if (!detailsCheck.valid) {
      const firstDetErr = detailsCheck.errors.address || detailsCheck.errors.bio || detailsCheck.errors.photoURL;
      toast.error(firstDetErr || "Please complete all profile details.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        displayName: cleanName,
        dob: dob.trim(),
        photoURL: photoURL.trim(),
        phone: phoneCheck.formatted,
        state: selectedState.trim(),
        district: selectedDistrict.trim(),
        city: city.trim(),
        address: address.trim(),
        bio: bio.trim(),
      });
      toast.success("Profile updated successfully.");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const todayIso = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={() => !saving && onClose()}
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Edit User Profile
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All 9 profile fields are required for a complete profile
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close edit profile modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[calc(85vh-8rem)] overflow-y-auto">
          {/* 1. Avatar Section (Required) */}
          <div
            className={`p-4 rounded-xl border transition ${
              photoState === "invalid"
                ? "bg-rose-50/30 dark:bg-rose-950/20 border-rose-500"
                : photoState === "valid"
                ? "bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60"
            } space-y-3`}
          >
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Profile Avatar <span className="text-rose-500">*</span>
              </label>
              {photoState === "valid" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Avatar selected
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div
                className={`relative w-20 h-20 rounded-2xl bg-purple-100 dark:bg-purple-950/60 border-2 overflow-hidden flex items-center justify-center text-xl font-bold text-purple-700 dark:text-purple-300 flex-shrink-0 transition ${
                  photoState === "invalid"
                    ? "border-rose-500 ring-2 ring-rose-500/50"
                    : photoState === "valid"
                    ? "border-emerald-500"
                    : "border-purple-200 dark:border-purple-800"
                }`}
              >
                {uploadingImage ? (
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                ) : photoURL ? (
                  <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  fullName.slice(0, 2).toUpperCase() || <Camera className="w-6 h-6 text-slate-400" />
                )}
              </div>

              <div className="space-y-2 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm min-h-[36px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </button>

                  {photoURL && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoURL("");
                        setPhotoTouched(true);
                      }}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 transition min-h-[36px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  <span className="text-[11px] text-slate-400">Or pick preset:</span>
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPhotoURL(url);
                        setPhotoTouched(true);
                      }}
                      aria-label={`Select avatar preset ${idx + 1}`}
                      className="w-6 h-6 rounded-full overflow-hidden border border-slate-300 hover:scale-110 transition"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {photoState === "invalid" && photoErrorMessage && (
              <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{photoErrorMessage}</span>
              </p>
            )}
          </div>

          {/* 2 & 3. Full Name & Date of Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    const formatted = formatFullName(e.target.value);
                    setFullName(formatted);
                    setNameTouched(true);
                  }}
                  onBlur={() => setNameTouched(true)}
                  placeholder="e.g. Rahul Sharma"
                  aria-invalid={nameState === "invalid"}
                  className={`w-full pl-9 pr-9 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-purple-600 focus:outline-none transition min-h-[44px] ${getFieldBorderClass(
                    nameState
                  )}`}
                />
                {nameState === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-3 pointer-events-none" />
                )}
                {nameState === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-3 top-3 pointer-events-none" />
                )}
              </div>
              {nameState === "invalid" && nameErrorMessage && (
                <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{nameErrorMessage}</span>
                </p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Date of Birth (18+ Years) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={dob}
                  max={todayIso}
                  onChange={(e) => {
                    setDob(e.target.value);
                    setDobTouched(true);
                  }}
                  onBlur={() => setDobTouched(true)}
                  aria-invalid={dobState === "invalid"}
                  className={`w-full pl-9 pr-9 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-purple-600 focus:outline-none transition min-h-[44px] ${getFieldBorderClass(
                    dobState
                  )}`}
                />
                {dobState === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-3 pointer-events-none" />
                )}
                {dobState === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-3 top-3 pointer-events-none" />
                )}
              </div>
              {dobState === "invalid" && dobErrorMessage && (
                <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{dobErrorMessage}</span>
                </p>
              )}
            </div>
          </div>

          {/* 4. Indian Mobile Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Indian Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex rounded-xl shadow-sm">
              {/* Permanent +91 Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 rounded-l-xl border border-r-0 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold select-none">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>+91</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
              </div>
              <div className="relative flex-1">
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(e) => {
                    const cleaned = cleanMobileInput(e.target.value);
                    setPhone(cleaned);
                    setPhoneTouched(true);
                  }}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="9876543210"
                  aria-invalid={phoneState === "invalid"}
                  className={`w-full rounded-r-xl rounded-l-none pl-3 pr-9 py-2 text-sm border focus:ring-2 focus:ring-purple-600 focus:outline-none transition min-h-[44px] ${getFieldBorderClass(
                    phoneState
                  )}`}
                />
                {phoneState === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-3 pointer-events-none" />
                )}
                {phoneState === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-3 top-3 pointer-events-none" />
                )}
              </div>
            </div>
            {phoneState === "invalid" && phoneErrorMessage && (
              <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{phoneErrorMessage}</span>
              </p>
            )}
          </div>

          {/* 5, 6, 7. Location Fields: State, District, City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* State */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                State <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={(e) => {
                    const newState = e.target.value;
                    setSelectedState(newState);
                    setSelectedDistrict("");
                    setCity("");
                    setStateTouched(true);
                    setDistrictTouched(false);
                    setCityTouched(false);
                  }}
                  onBlur={() => setStateTouched(true)}
                  aria-invalid={stateState === "invalid"}
                  className={`w-full px-3 pr-8 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-purple-600 focus:outline-none min-h-[44px] transition ${getFieldBorderClass(
                    stateState
                  )}`}
                >
                  <option value="">Select State</option>
                  {activeStates.map((st) => (
                    <option key={st.id} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>
                {stateState === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-2.5 top-3 pointer-events-none" />
                )}
                {stateState === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-2.5 top-3 pointer-events-none" />
                )}
              </div>
              {stateState === "invalid" && stateErrorMessage && (
                <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{stateErrorMessage}</span>
                </p>
              )}
            </div>

            {/* District */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                District <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setDistrictTouched(true);
                  }}
                  onBlur={() => setDistrictTouched(true)}
                  disabled={!selectedState}
                  aria-invalid={districtState === "invalid"}
                  className={`w-full px-3 pr-8 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-purple-600 focus:outline-none min-h-[44px] disabled:opacity-50 transition ${getFieldBorderClass(
                    districtState
                  )}`}
                >
                  <option value="">Select District</option>
                  {currentDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {districtState === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-2.5 top-3 pointer-events-none" />
                )}
                {districtState === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-2.5 top-3 pointer-events-none" />
                )}
              </div>
              {districtState === "invalid" && districtErrorMessage && (
                <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{districtErrorMessage}</span>
                </p>
              )}
            </div>

            {/* City / Town */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                City / Town <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setCityTouched(true);
                  }}
                  onBlur={() => setCityTouched(true)}
                  placeholder="e.g. Mumbai"
                  aria-invalid={cityState === "invalid"}
                  className={`w-full px-3 pr-8 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-purple-600 focus:outline-none min-h-[44px] transition ${getFieldBorderClass(
                    cityState
                  )}`}
                />
                {cityState === "valid" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-2.5 top-3 pointer-events-none" />
                )}
                {cityState === "invalid" && (
                  <AlertCircle className="w-4 h-4 text-rose-500 absolute right-2.5 top-3 pointer-events-none" />
                )}
              </div>
              {cityState === "invalid" && cityErrorMessage && (
                <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{cityErrorMessage}</span>
                </p>
              )}
            </div>
          </div>

          {/* 8. Address / Area */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Address / Area <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                required
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setAddressTouched(true);
                }}
                onBlur={() => setAddressTouched(true)}
                placeholder="e.g. Sector 12, Andheri West"
                aria-invalid={addressState === "invalid"}
                className={`w-full pl-9 pr-9 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-purple-600 focus:outline-none transition min-h-[44px] ${getFieldBorderClass(
                  addressState
                )}`}
              />
              {addressState === "valid" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-3 pointer-events-none" />
              )}
              {addressState === "invalid" && (
                <AlertCircle className="w-4 h-4 text-rose-500 absolute right-3 top-3 pointer-events-none" />
              )}
            </div>
            {addressState === "invalid" && addressErrorMessage && (
              <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{addressErrorMessage}</span>
              </p>
            )}
          </div>

          {/* 9. Bio / About You */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Bio / About You <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <textarea
                rows={2}
                required
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  setBioTouched(true);
                }}
                onBlur={() => setBioTouched(true)}
                placeholder="Tell other community members a bit about yourself..."
                aria-invalid={bioState === "invalid"}
                className={`w-full px-3.5 pr-8 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-purple-600 focus:outline-none resize-none transition min-h-[64px] ${getFieldBorderClass(
                  bioState
                )}`}
              />
              {bioState === "valid" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-2.5 top-3 pointer-events-none" />
              )}
              {bioState === "invalid" && (
                <AlertCircle className="w-4 h-4 text-rose-500 absolute right-2.5 top-3 pointer-events-none" />
              )}
            </div>
            {bioState === "invalid" && bioErrorMessage && (
              <p className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{bioErrorMessage}</span>
              </p>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || uploadingImage || !isFormValid}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
