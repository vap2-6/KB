import React, { useState, useRef } from 'react';

export default function MealRegistrationForm() {
    const [photoDataUrl, setPhotoDataUrl] = useState("");
    const [signatureDataUrl, setSignatureDataUrl] = useState("");
    const [submitSuccessModalOpen, setSubmitSuccessModalOpen] = useState(false);
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [duplicateMessage, setDuplicateMessage] = useState("Application already submitted");
    const [duplicateTag, setDuplicateTag] = useState("use another registration number for a new form");
    const [dobDate, setDobDate] = useState("");
    const [dobInput, setDobInput] = useState("");
    const [calculatedAge, setCalculatedAge] = useState("");
    const [deptNumber, setDeptNumber] = useState("");
    const [isFetchingStudent, setIsFetchingStudent] = useState(false);
    const [fetchStatusMessage, setFetchStatusMessage] = useState("");
    const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
    const [mealSession, setMealSession] = useState("");
    const [isAutoFetched, setIsAutoFetched] = useState(false);
    const [autoCourse, setAutoCourse] = useState("");
    const [autoDepartment, setAutoDepartment] = useState("");

    const fetchStudentByDeptNumber = async (num) => {
        const cleanNum = (num || "").trim();
        if (!cleanNum || cleanNum.length !== 13) return;

        setIsFetchingStudent(true);
        setFetchStatusMessage("Searching database...");

        try {
            let base = import.meta.env.VITE_API_BASE_URL || '/api/register';
            if (base.endsWith('/api/register')) {
                base = base.substring(0, base.length - '/api/register'.length);
            }
            base = base.replace(/\/+$/, '');

            const candidateUrls = [
                `${base}/api/register/fetch-student?dept_number=${encodeURIComponent(cleanNum)}`,
                `/api/register/fetch-student?dept_number=${encodeURIComponent(cleanNum)}`,
                `${base}/api/register/check?dept=${encodeURIComponent(cleanNum)}`,
                `/api/register/check?dept=${encodeURIComponent(cleanNum)}`
            ];

            let fetchedData = null;
            let alreadyReg = false;
            for (const fetchUrl of candidateUrls) {
                try {
                    const res = await fetch(fetchUrl);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.already_registered || data.exists) {
                            alreadyReg = true;
                            break;
                        }
                        if (data.found && data.student) {
                            fetchedData = data.student;
                            break;
                        }
                    }
                } catch (e) {
                    // try next URL
                }
            }

            if (alreadyReg) {
                setFetchStatusMessage("⚠ Already registered with this Department Number");
                setIsAlreadyRegistered(true);
                setIsAutoFetched(false);
                return;
            }

            if (fetchedData) {
                setIsAlreadyRegistered(false);
                setIsAutoFetched(true);
                setFetchStatusMessage("✓ Student details auto-fetched");

                if (fetchedData.student_name) {
                    const el = document.getElementById('student_name');
                    if (el) el.value = fetchedData.student_name;
                }
                if (fetchedData.date_of_birth) {
                    let isoDate = fetchedData.date_of_birth;
                    if (isoDate.includes('/')) {
                        const p = isoDate.split('/');
                        if (p.length === 3) {
                            isoDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                        }
                    }
                    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
                        setDobDate(isoDate);
                        setDobInput(formatIsoToDdMmYyyy(isoDate));
                        setCalculatedAge(calculateAgeFromIsoDate(isoDate));
                    }
                }
                if (fetchedData.course) {
                    const el = document.getElementById('course');
                    if (el) el.value = fetchedData.course;
                    setAutoCourse(fetchedData.course);
                }
                if (fetchedData.department) {
                    const el = document.getElementById('department');
                    if (el) el.value = fetchedData.department;
                    setAutoDepartment(fetchedData.department);
                }
                if (fetchedData.degree_year) {
                    const el = document.getElementById('degree_year_select');
                    if (el) el.value = String(fetchedData.degree_year);
                }
                if (fetchedData.permanent_address) {
                    const el = document.getElementById('permanent_address');
                    if (el) el.value = fetchedData.permanent_address;
                }
                if (fetchedData.permanent_pin) {
                    const el = document.getElementById('permanent_pin');
                    if (el) el.value = fetchedData.permanent_pin;
                }
                if (fetchedData.local_address) {
                    const el = document.getElementById('local_address');
                    if (el) el.value = fetchedData.local_address;
                }
                if (fetchedData.local_pin) {
                    const el = document.getElementById('local_pin');
                    if (el) el.value = fetchedData.local_pin;
                }
                if (fetchedData.landline) {
                    const el = document.getElementById('landline');
                    if (el) el.value = fetchedData.landline;
                }
                if (fetchedData.mobile_no) {
                    const el = document.getElementById('mobile_no');
                    if (el) el.value = fetchedData.mobile_no;
                }
                if (fetchedData.email) {
                    const el = document.getElementById('email');
                    if (el) el.value = fetchedData.email;
                }
                if (fetchedData.father_name) {
                    const el = document.getElementById('father_name');
                    if (el) el.value = fetchedData.father_name;
                }
                if (fetchedData.father_occupation) {
                    const el = document.getElementById('father_occupation');
                    if (el) el.value = fetchedData.father_occupation;
                }
                if (fetchedData.employment_type) {
                    const el = document.getElementById('employment_type');
                    if (el) el.value = fetchedData.employment_type;
                }
                if (fetchedData.annual_income) {
                    const el = document.getElementById('annual_income');
                    if (el) el.value = fetchedData.annual_income;
                }
                if (fetchedData.religion) {
                    const el = document.getElementById('religion');
                    if (el) el.value = fetchedData.religion;
                }
                if (fetchedData.community) {
                    const el = document.getElementById('community');
                    if (el) el.value = fetchedData.community;
                }
                if (fetchedData.distance_km) {
                    const el = document.getElementById('distance_km');
                    if (el) el.value = fetchedData.distance_km;
                }
                if (fetchedData.forenoon_meal !== undefined || fetchedData.afternoon_meal !== undefined) {
                    if (fetchedData.forenoon_meal && fetchedData.afternoon_meal) {
                        setMealSession('both');
                    } else if (fetchedData.forenoon_meal) {
                        setMealSession('forenoon');
                    } else if (fetchedData.afternoon_meal) {
                        setMealSession('afternoon');
                    }
                }

                if (fetchedData.student_photo_url) {
                    let photoUrl = fetchedData.student_photo_url;
                    // Build absolute URL for the stored photo
                    if (photoUrl && !photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
                        // Use the same origin as the current page to serve uploads
                        let apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/register$/, '').replace(/\/+$/, '');
                        if (!apiBase) {
                            apiBase = window.location.origin;
                        }
                        // Ensure the path starts with /uploads/
                        if (!photoUrl.startsWith('/')) photoUrl = '/' + photoUrl;
                        photoUrl = apiBase + photoUrl;
                    }
                    setPhotoDataUrl(photoUrl);
                    if (photoPreviewRef.current) {
                        photoPreviewRef.current.src = photoUrl;
                        photoPreviewRef.current.classList.remove('hidden');
                        if (uploadPlaceholderRef.current) {
                            uploadPlaceholderRef.current.classList.add('hidden');
                        }
                    }
                }


            } else {
                setIsAlreadyRegistered(false);
                setFetchStatusMessage("No existing details found");
                setTimeout(() => setFetchStatusMessage(""), 3000);
            }
        } catch (err) {
            console.warn("Auto fetch error:", err);
            setFetchStatusMessage("");
        } finally {
            setIsFetchingStudent(false);
        }
    };

    const handleDeptNumberInputChange = (e) => {
        const val = e.target.value.replace(/\D/g, '');
        setDeptNumber(val);
        if (val.length === 13) {
            fetchStudentByDeptNumber(val);
        } else {
            setIsAutoFetched(false);
            setAutoCourse("");
            setAutoDepartment("");
            setFetchStatusMessage("");
            setIsAlreadyRegistered(false);
            // Reset photo preview when dept number changes
            setPhotoDataUrl("");
            if (photoPreviewRef.current) {
                photoPreviewRef.current.classList.add('hidden');
                if (uploadPlaceholderRef.current) {
                    uploadPlaceholderRef.current.classList.remove('hidden');
                }
            }
        }
    };

    const calculateAgeFromIsoDate = (isoStr) => {
        if (!isoStr) return "";
        const parts = isoStr.split('-');
        if (parts.length !== 3) return "";
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return "";

        const birthDate = new Date(year, month - 1, day);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return (age >= 10 && age <= 80) ? age : "";
    };

    const formatIsoToDdMmYyyy = (isoStr) => {
        if (!isoStr) return "";
        const parts = isoStr.split('-');
        if (parts.length !== 3) return "";
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    };

    const handleDobChange = (e) => {
        const isoVal = e.target.value;
        setDobDate(isoVal);
        const formatted = formatIsoToDdMmYyyy(isoVal);
        setDobInput(formatted);
        const computedAge = calculateAgeFromIsoDate(isoVal);
        setCalculatedAge(computedAge);
    };

    const photoInputRef = useRef(null);
    const mealFormRef = useRef(null);
    const previewModalRef = useRef(null);
    const incomeProofInputRef = useRef(null);
    const applicantSignatureInputRef = useRef(null);
    const photoPreviewRef = useRef(null);
    const uploadPlaceholderRef = useRef(null);

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.addEventListener('load', function () {
                setPhotoDataUrl(this.result);
                if (photoPreviewRef.current) {
                    photoPreviewRef.current.src = this.result;
                    photoPreviewRef.current.classList.remove('hidden');
                    if (uploadPlaceholderRef.current) {
                        uploadPlaceholderRef.current.classList.add('hidden');
                    }
                }
            });
            reader.readAsDataURL(file);
        }
    };

    const handleSignatureChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.addEventListener('load', function () {
                setSignatureDataUrl(this.result);
                const modalSignature = document.getElementById('modal-signature-view');
                if (modalSignature) {
                    modalSignature.src = this.result;
                }
            });
            reader.readAsDataURL(file);
        }
    };

    const validateMealForm = () => {
        if (!mealFormRef.current?.checkValidity()) {
            mealFormRef.current?.reportValidity();
            return false;
        }

        if (!incomeProofInputRef.current?.files.length) {
            alert('Please upload the pay slip / income certificate before previewing and submitting.');
            return false;
        }

        if (!applicantSignatureInputRef.current?.files.length) {
            alert('Please upload the applicant signature before previewing and submitting.');
            return false;
        }

        const deptNumberValue = document.getElementById('dept_number')?.value.trim();
        if (!/^\d{13}$/.test(deptNumberValue)) {
            alert('Department Number must be exactly 13 digits.');
            document.getElementById('dept_number')?.focus();
            return false;
        }

        if (!dobDate || calculatedAge === "" || calculatedAge < 0) {
            alert('Please select a valid Date of Birth.');
            document.getElementById('dob_picker')?.focus();
            return false;
        }

        const mobileValue = document.getElementById('mobile_no')?.value.trim();
        if (!/^\d{10}$/.test(mobileValue)) {
            alert('Please enter a valid 10 digit mobile number.');
            document.getElementById('mobile_no')?.focus();
            return false;
        }

        const emailValue = document.getElementById('email')?.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailValue || !emailRegex.test(emailValue)) {
            alert('Please enter a valid email address.');
            document.getElementById('email')?.focus();
            return false;
        }

        const forenoonChecked = document.getElementById('forenoon_meal')?.checked;
        const afternoonChecked = document.getElementById('afternoon_meal')?.checked;
        const bothChecked = document.getElementById('both_meal')?.checked;
        if (!forenoonChecked && !afternoonChecked && !bothChecked) {
            alert('Please select at least one meal session (Forenoon, Afternoon, or Both).');
            return false;
        }

        return true;
    };

    const checkDuplicateRegistration = async (deptNumber, mobileNo) => {
        try {
            let base = import.meta.env.VITE_API_BASE_URL || '/api/register';
            if (base.endsWith('/api/register')) {
                base = base.substring(0, base.length - '/api/register'.length);
            }
            base = base.replace(/\/+$/, '');

            const candidateUrls = [
                `${base}/api/register/api/register/check?dept=${encodeURIComponent(deptNumber || '')}&mobile=${encodeURIComponent(mobileNo || '')}`,
                `${base}/api/register/check?dept=${encodeURIComponent(deptNumber || '')}&mobile=${encodeURIComponent(mobileNo || '')}`,
                `/api/register/check?dept=${encodeURIComponent(deptNumber || '')}&mobile=${encodeURIComponent(mobileNo || '')}`
            ];

            for (const checkUrl of candidateUrls) {
                try {
                    const res = await fetch(checkUrl);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.exists) {
                            return data;
                        }
                    }
                } catch (e) {
                    // try next URL
                }
            }
        } catch (err) {
            console.warn("Duplicate check pre-fetch error:", err);
        }
        return null;
    };

    const populateAndShowModal = () => {
        const modalPhotoView = document.getElementById('modal-photo-view');
        if (modalPhotoView) modalPhotoView.src = photoDataUrl || '#';

        const studentName = document.getElementById('student_name');
        const pName = document.getElementById('p-name');
        if (pName) pName.innerText = studentName?.value;

        const dobAge = document.getElementById('dob_age');
        const pDob = document.getElementById('p-dob');
        if (pDob) pDob.innerText = dobAge?.value;

        const course = document.getElementById('course');
        const pCourse = document.getElementById('p-course');
        if (pCourse) pCourse.innerText = course?.value;

        const department = document.getElementById('department');
        const pDepartment = document.getElementById('p-department');
        if (pDepartment) pDepartment.innerText = department?.value;

        const degreeYear = document.getElementById('degree_year_select');
        const pDegreeYear = document.getElementById('p-degree-year');
        if (pDegreeYear) pDegreeYear.innerText = degreeYear?.value;

        const deptNumber = document.getElementById('dept_number');
        const pDeptNo = document.getElementById('p-dept-no');
        if (pDeptNo) pDeptNo.innerText = deptNumber?.value;

        const permanentAddress = document.getElementById('permanent_address');
        const permanentPin = document.getElementById('permanent_pin');
        const pPermAddr = document.getElementById('p-perm-addr');
        if (pPermAddr) pPermAddr.innerText = (permanentAddress?.value || "") + " - Pin: " + (permanentPin?.value || "");

        const localAddress = document.getElementById('local_address');
        const localPin = document.getElementById('local_pin');
        const pLocalAddr = document.getElementById('p-local-addr');
        if (pLocalAddr) pLocalAddr.innerText = (localAddress?.value || "") + " - Pin: " + (localPin?.value || "");

        const landline = document.getElementById('landline');
        const pLand = document.getElementById('p-land');
        if (pLand) pLand.innerText = landline?.value || 'N/A';

        const mobileNo = document.getElementById('mobile_no');
        const pMobile = document.getElementById('p-mobile');
        if (pMobile) pMobile.innerText = mobileNo?.value;

        const emailInput = document.getElementById('email');
        const pEmail = document.getElementById('p-email');
        if (pEmail) pEmail.innerText = emailInput?.value || 'N/A';

        const fatherName = document.getElementById('father_name');
        const pFatherName = document.getElementById('p-father-name');
        if (pFatherName) pFatherName.innerText = fatherName?.value;

        const fatherOccupation = document.getElementById('father_occupation');
        const pFatherOccupation = document.getElementById('p-father-occupation');
        if (pFatherOccupation) pFatherOccupation.innerText = fatherOccupation?.value;

        const employmentType = document.getElementById('employment_type');
        const pEmploy = document.getElementById('p-employ');
        if (pEmploy) pEmploy.innerText = employmentType?.value;

        const annualIncome = document.getElementById('annual_income');
        const pIncome = document.getElementById('p-income');
        if (pIncome) pIncome.innerText = Number(annualIncome?.value).toLocaleString('en-IN');

        const religion = document.getElementById('religion');
        const pReligion = document.getElementById('p-religion');
        if (pReligion) pReligion.innerText = religion?.value;

        const community = document.getElementById('community');
        const pCommunity = document.getElementById('p-community');
        if (pCommunity) pCommunity.innerText = community?.value;

        const distanceKm = document.getElementById('distance_km');
        const pDist = document.getElementById('p-dist');
        if (pDist) pDist.innerText = distanceKm?.value;

        const sessions = [];
        const forenoonMeal = document.getElementById('forenoon_meal');
        const afternoonMeal = document.getElementById('afternoon_meal');
        const bothMeal = document.getElementById('both_meal');
        if (bothMeal?.checked || (forenoonMeal?.checked && afternoonMeal?.checked)) {
            sessions.push('Forenoon', 'Afternoon');
        } else {
            if (forenoonMeal?.checked) sessions.push('Forenoon');
            if (afternoonMeal?.checked) sessions.push('Afternoon');
        }
        const pMealSession = document.getElementById('p-meal-session');
        if (pMealSession) pMealSession.innerText = sessions.length ? sessions.join(' & ') : 'None selected';

        if (previewModalRef.current) {
            previewModalRef.current.classList.remove('hidden');
        }
    };

    const handleCopyPermanent = () => {
        const permanentAddress = document.getElementById('permanent_address');
        const permanentPin = document.getElementById('permanent_pin');
        const localAddress = document.getElementById('local_address');
        const localPin = document.getElementById('local_pin');

        if (localAddress) localAddress.value = permanentAddress?.value || "";
        if (localPin) localPin.value = permanentPin?.value || "";
    };

    const handleReview = async (e) => {
        e.preventDefault();
        if (!validateMealForm()) return;

        const deptNumber = document.getElementById('dept_number')?.value.trim();
        const mobileNo = document.getElementById('mobile_no')?.value.trim();

        const reviewBtn = document.getElementById('reviewBtn');
        if (reviewBtn) {
            reviewBtn.disabled = true;
            reviewBtn.innerText = 'Checking...';
        }

        try {
            const dupResult = await checkDuplicateRegistration(deptNumber, mobileNo);
            if (dupResult && dupResult.exists) {
                setDuplicateMessage(dupResult.error || "Application already submitted");
                setDuplicateTag(dupResult.tag || "use another registration number for a new form");
                setDuplicateModalOpen(true);
                return;
            }
        } finally {
            if (reviewBtn) {
                reviewBtn.disabled = false;
                reviewBtn.innerText = 'Review';
            }
        }

        const signatureFile = applicantSignatureInputRef.current?.files?.[0];
        if (signatureFile) {
            const signatureReader = new FileReader();
            signatureReader.addEventListener('load', function () {
                const modalSignature = document.getElementById('modal-signature-view');
                if (modalSignature) modalSignature.src = this.result;
                populateAndShowModal();
            });
            signatureReader.readAsDataURL(signatureFile);
        } else {
            populateAndShowModal();
        }
    };

    const handleCloseModal = () => {
        if (previewModalRef.current) {
            previewModalRef.current.classList.add('hidden');
        }
    };

    const handleSuccessOk = () => {
        setSubmitSuccessModalOpen(false);
        if (mealFormRef.current) {
            mealFormRef.current.reset();
        }
        setPhotoDataUrl("");
        setSignatureDataUrl("");
        window.location.href = window.location.pathname + '?nocache=' + Date.now();
    };

    const handleCloseDuplicateModal = () => {
        setDuplicateModalOpen(false);
        if (previewModalRef.current) {
            previewModalRef.current.classList.add('hidden');
        }
        setTimeout(() => {
            const deptInput = document.getElementById('dept_number');
            if (deptInput) {
                deptInput.focus();
                deptInput.select();
            }
        }, 100);
    };

    const handleConfirmSubmit = async (e) => {
        e.preventDefault();
        if (!validateMealForm()) return;

        const deptNumber = document.getElementById('dept_number')?.value.trim();
        const mobileNo = document.getElementById('mobile_no')?.value.trim();

        const confirmSubmitBtn = e.currentTarget;
        confirmSubmitBtn.disabled = true;
        const originalText = confirmSubmitBtn.innerText;
        confirmSubmitBtn.innerText = 'Submitting...';

        try {
            const dupResult = await checkDuplicateRegistration(deptNumber, mobileNo);
            if (dupResult && dupResult.exists) {
                if (previewModalRef.current) {
                    previewModalRef.current.classList.add('hidden');
                }
                setDuplicateMessage(dupResult.error || "Application already submitted");
                setDuplicateTag(dupResult.tag || "use another registration number for a new form");
                setDuplicateModalOpen(true);
                return;
            }

            const formData = new FormData(mealFormRef.current);
            let base = import.meta.env.VITE_API_BASE_URL || '/api/register';
            if (base.endsWith('/api/register')) {
                base = base.substring(0, base.length - '/api/register'.length);
            }
            base = base.replace(/\/+$/, '');

            const candidateUrls = [
                '/api/register',
                '/api/register/submit',
                `${base}/api/register`
            ];

            let res = null;
            for (const fetchUrl of candidateUrls) {
                try {
                    const candidateRes = await fetch(fetchUrl, { method: 'POST', body: formData });
                    if (candidateRes && candidateRes.status !== 404 && candidateRes.status !== 500) {
                        res = candidateRes;
                        break;
                    } else if (candidateRes) {
                        res = candidateRes;
                    }
                } catch (err) {
                    console.warn(`Fetch POST error for ${fetchUrl}:`, err);
                }
            }

            if (!res) {
                alert('Upload failed: Unable to connect to backend server.');
                return;
            }

            if (res.status === 409) {
                let j = {};
                try { j = await res.json(); } catch (e) { }
                if (previewModalRef.current) {
                    previewModalRef.current.classList.add('hidden');
                }
                setDuplicateMessage(j.error || "Application already submitted");
                setDuplicateTag(j.tag || "use another registration number for a new form");
                setDuplicateModalOpen(true);
                return;
            }

            if (!res.ok) {
                let msg = `Server error: ${res.status}`;
                let isDuplicate = false;
                try {
                    const j = await res.json();
                    if (j) {
                        if (j.error) msg = j.error;
                        if (j.tag) setDuplicateTag(j.tag);
                        if (j.details === 'DUPLICATE_REGISTRATION' || (msg && (msg.toLowerCase().includes('already submitted') || msg.toLowerCase().includes('duplicate')))) {
                            isDuplicate = true;
                        }
                    }
                } catch (e) { }

                if (isDuplicate) {
                    if (previewModalRef.current) {
                        previewModalRef.current.classList.add('hidden');
                    }
                    setDuplicateMessage(msg || "Application already submitted");
                    setDuplicateModalOpen(true);
                    return;
                }

                alert(msg);
                return;
            }

            const blob = await res.blob();
            const disposition = res.headers.get('content-disposition') || '';
            let filename = 'application.pdf';
            const m = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/);
            if (m) filename = decodeURIComponent(m[1] || m[2]);

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            if (previewModalRef.current) {
                previewModalRef.current.classList.add('hidden');
            }
            setSubmitSuccessModalOpen(true);

        } catch (err) {
            alert('Upload failed: ' + (err.message || err));
        } finally {
            confirmSubmitBtn.disabled = false;
            confirmSubmitBtn.innerText = originalText;
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
    };

    return (
        <div className="bg-amber-50/40 min-h-screen py-6 px-4 md:px-8 font-sans">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg border border-amber-200/70 p-6 md:p-8">
                <div className="text-center border-b border-amber-200 pb-6 mb-6 relative flex flex-col items-center">
                    <img src={`${import.meta.env.BASE_URL}logo_img.png`} alt="Ramakrishna Mission Logo" className="h-24 w-24 object-contain mb-3 drop-shadow-sm" />
                    <h2 className="text-xl md:text-2xl font-bold text-amber-950 tracking-wide uppercase">
                        Ramakrishna Mission Vidyapith
                    </h2>
                    <p className="text-xs md:text-sm text-gray-600 font-medium tracking-wider mt-1">
                        MYLAPORE, CHENNAI - 600 004.
                    </p>
                    <h3 className="text-base md:text-lg font-extrabold text-amber-800 bg-amber-100/60 inline-block px-4 py-1.5 rounded-md mt-4 uppercase tracking-wide border border-amber-200">
                        Application for Free Noon Meals ID
                    </h3>
                </div>

                <form ref={mealFormRef} id="mealForm" action="/api/register" method="POST" encType="multipart/form-data" className="space-y-6" onSubmit={handleFormSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                                <span>Department Number (13 Digits) *</span>
                                {fetchStatusMessage && !isAlreadyRegistered && (
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded transition-all ${fetchStatusMessage.includes('No existing') ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-green-100 text-green-800 border border-green-300'}`}>
                                        {fetchStatusMessage}
                                    </span>
                                )}
                            </label>
                            <div className="relative flex items-center">
                                <input
                                    type="text"
                                    id="dept_number"
                                    name="dept_number"
                                    value={deptNumber}
                                    onChange={handleDeptNumberInputChange}
                                    onBlur={() => fetchStudentByDeptNumber(deptNumber)}
                                    placeholder="Enter 13-digit Department Number (e.g. 2433010340210)"
                                    maxLength="13"
                                    inputMode="numeric"
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-sans text-gray-900 font-medium text-base shadow-xs"
                                />
                                {isFetchingStudent && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                                        <svg className="animate-spin h-5 w-5 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">Entering an existing 13-digit Department Number will automatically populate student details.</p>
                            {isAlreadyRegistered && (
                                <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-lg flex items-start gap-2">
                                    <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-bold text-red-800">This Department Number is already registered.</p>
                                        <p className="text-xs text-red-700 mt-0.5">Each Department Number can only be used once. Please enter a different number to proceed with a new registration.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-center">
                            <label className="block text-sm font-semibold text-gray-700 mb-2 text-center w-full">Student Photo</label>
                            <div className="w-28 h-36 border-2 border-amber-300/80 rounded-lg bg-amber-50/50 shadow-xs flex flex-col items-center justify-center overflow-hidden relative">
                                {photoDataUrl ? (
                                    <img src={photoDataUrl} alt="Student Photo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-2 text-center">
                                        <svg className="w-8 h-8 text-amber-500/70 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Passport Photo</span>
                                        <span className="text-[9px] text-gray-400 font-medium">(Auto-fetched)</span>
                                    </div>
                                )}
                            </div>
                            <input type="hidden" id="student_photo_url" name="student_photo_url" value={photoDataUrl} />
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Name of the Student *
                            </label>
                            <input
                                type="text"
                                id="student_name"
                                name="student_name"
                                required
                                readOnly={isAutoFetched}
                                className={`w-full px-4 py-2 border border-gray-300 rounded-md outline-none transition-all ${isAutoFetched ? 'bg-gray-100 text-gray-700 cursor-not-allowed font-medium' : 'bg-white focus:ring-2 focus:ring-amber-500'}`}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Date of Birth *
                            </label>
                            <div className="relative flex items-center">
                                <input
                                    type="date"
                                    id="dob_picker"
                                    value={dobDate}
                                    onChange={handleDobChange}
                                    onClick={(e) => { if (!isAutoFetched) { try { e.target.showPicker(); } catch (err) { } } }}
                                    max={new Date().toISOString().split('T')[0]}
                                    min="1950-01-01"
                                    required
                                    readOnly={isAutoFetched}
                                    disabled={isAutoFetched}
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-md outline-none font-sans text-gray-800 pr-28 transition-all ${isAutoFetched ? 'bg-gray-100 text-gray-700 cursor-not-allowed font-medium pointer-events-none' : 'cursor-pointer bg-white focus:ring-2 focus:ring-amber-500 [&::-webkit-calendar-picker-indicator]:hidden'}`}
                                />
                                {calculatedAge !== "" && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-md border border-amber-300 shadow-xs pointer-events-none">
                                        Age: {calculatedAge} Yrs
                                    </span>
                                )}
                            </div>
                            <input type="hidden" id="dob_input" name="date_of_birth" value={dobInput} />
                            <input type="hidden" id="dob_age" name="dob_age" value={dobInput ? `${dobInput} (${calculatedAge ? calculatedAge + ' Years' : ''})` : ''} />
                            <input type="hidden" id="calculated_age_input" name="age" value={calculatedAge} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Course *
                            </label>
                            <select
                                id="course"
                                name={isAutoFetched ? undefined : "course"}
                                disabled={isAutoFetched}
                                required
                                onChange={(e) => setAutoCourse(e.target.value)}
                                className={`w-full px-4 py-2 border border-gray-300 rounded-md outline-none transition-all ${isAutoFetched ? 'bg-gray-100 text-gray-700 cursor-not-allowed font-medium' : 'bg-white focus:ring-2 focus:ring-amber-500'}`}
                            >
                                <option value="">Select Course</option>
                                <option value="B.Sc. Computer Science">B.Sc</option>
                                <option value="B.Com">B.Com</option>
                                <option value="B.A.">B.A.</option>
                                <option value="B.E.">B.E.</option>
                                <option value="M.Sc.">M.Sc.</option>
                                <option value="M.Com">M.Com</option>
                                <option value="M.A.">M.A.</option>
                            </select>
                            {isAutoFetched && <input type="hidden" name="course" value={autoCourse || document.getElementById('course')?.value || ''} />}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Department *
                            </label>
                            <select
                                id="department"
                                name={isAutoFetched ? undefined : "department"}
                                disabled={isAutoFetched}
                                required
                                onChange={(e) => setAutoDepartment(e.target.value)}
                                className={`w-full px-4 py-2 border border-gray-300 rounded-md outline-none transition-all ${isAutoFetched ? 'bg-gray-100 text-gray-700 cursor-not-allowed font-medium' : 'bg-white focus:ring-2 focus:ring-amber-500'}`}
                            >
                                <option value="">Select Department</option>
                                <option value="Economics">Economics</option>
                                <option value="English">English</option>
                                <option value="History">History</option>
                                <option value="Philosophy">Philosophy</option>
                                <option value="Sanskrit">Sanskrit</option>
                                <option value="Tamil">Tamil</option>
                                <option value="Advanced Zoology & Biotechnology">Advanced Zoology & Biotechnology</option>
                                <option value="Plant Biology & Biotechnology">Plant Biology & Biotechnology</option>
                                <option value="Chemistry">Chemistry</option>
                                <option value="Mathematics">Mathematics</option>
                                <option value="Physics">Physics</option>
                                <option value="Computer Science">Computer Science</option>
                                <option value="Commerce">Commerce</option>
                            </select>
                            {isAutoFetched && <input type="hidden" name="department" value={autoDepartment || document.getElementById('department')?.value || ''} />}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Year of Degree *</label>
                            <select id="degree_year_select" name="degree_year" required className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                                <option value="">Select Year</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile No. *</label>
                            <input type="tel" id="mobile_no" name="mobile_no" required inputMode="numeric" maxLength="10" placeholder="10 digit mobile" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Permanent Address *</label>
                            <textarea id="permanent_address" name="permanent_address" rows="3" required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none resize-none"></textarea>
                            <input type="text" id="permanent_pin" name="permanent_pin" maxLength="6" placeholder="PIN Code" required className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none font-sans" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-1">
                                <label className="block text-sm font-semibold text-gray-700">Local Address *</label>
                                <button type="button" id="copyPermanentBtn" onClick={handleCopyPermanent} className="text-xs text-amber-700 font-semibold hover:text-amber-900 transition-colors">SAME AS PERMANENT ADDRESS</button>
                            </div>
                            <textarea id="local_address" name="local_address" rows="3" required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none resize-none"></textarea>
                            <input type="text" id="local_pin" name="local_pin" maxLength="6" placeholder="PIN Code" required className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none font-sans" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Land Line Contact No.</label>
                            <input type="tel" id="landline" name="landline" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Student Email Address *</label>
                            <input type="email" id="email" name="email" required placeholder="student@example.com" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Meal Session Required *</label>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-amber-50 transition-colors">
                                    <input 
                                        type="radio" 
                                        id="forenoon_meal" 
                                        name="meal_session" 
                                        value="forenoon" 
                                        checked={mealSession === 'forenoon'}
                                        onChange={() => setMealSession('forenoon')}
                                        className="w-4 h-4 accent-amber-700 cursor-pointer" 
                                        required 
                                    />
                                    <span className="text-sm font-medium text-gray-700">Forenoon Meal</span>
                                </label>
                                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-amber-50 transition-colors">
                                    <input 
                                        type="radio" 
                                        id="afternoon_meal" 
                                        name="meal_session" 
                                        value="afternoon" 
                                        checked={mealSession === 'afternoon'}
                                        onChange={() => setMealSession('afternoon')}
                                        className="w-4 h-4 accent-amber-700 cursor-pointer" 
                                        required 
                                    />
                                    <span className="text-sm font-medium text-gray-700">Afternoon Meal</span>
                                </label>
                                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-amber-50 transition-colors">
                                    <input 
                                        type="radio" 
                                        id="both_meal" 
                                        name="meal_session" 
                                        value="both" 
                                        checked={mealSession === 'both'}
                                        onChange={() => setMealSession('both')}
                                        className="w-4 h-4 accent-amber-700 cursor-pointer" 
                                        required 
                                    />
                                    <span className="text-sm font-medium text-gray-700">Both Meals</span>
                                </label>
                            </div>
                            {mealSession === 'forenoon' && <input type="hidden" name="forenoon_meal" value="on" />}
                            {mealSession === 'afternoon' && <input type="hidden" name="afternoon_meal" value="on" />}
                            {mealSession === 'both' && <input type="hidden" name="both_meal" value="on" />}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Father's Name *</label>
                            <input type="text" id="father_name" name="father_name" placeholder="e.g., Ramesh Kumar" required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Father's Occupation *</label>
                            <input type="text" id="father_occupation" name="father_occupation" placeholder="e.g., Farmer, Teacher" required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Is your parent a Govt employee or Private? *</label>
                            <select id="employment_type" name="employment_type" required className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                                <option value="">Select Sector</option>
                                <option value="Government">Government Employee</option>
                                <option value="Private">Private Sector</option>
                                <option value="Not Applicable">Not Applicable / None</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Annual Income *</label>
                            <input type="number" id="annual_income" name="annual_income" placeholder="Amount in ₹" required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Religion *</label>
                            <select id="religion" name="religion" required className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                                <option value="">Select Religion</option>
                                <option value="Hindu">Hindu</option>
                                <option value="Muslim">Muslim</option>
                                <option value="Christian">Christian</option>
                                <option value="Sikh">Sikh</option>
                                <option value="Jain">Jain</option>
                                <option value="Buddhist">Buddhist</option>
                                <option value="Parsi">Parsi</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Community *</label>
                            <select id="community" name="community" required className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                                <option value="">Select Community</option>
                                <option value="OC">OC</option>
                                <option value="BC">BC</option>
                                <option value="BC(M)">BC(M)</option>
                                <option value="MBC">MBC</option>
                                <option value="SC">SC</option>
                                <option value="SC(A)">SC(A)</option>
                                <option value="ST">ST</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Enclose Pay Slip / Income Certificate *</label>
                            <input type="file" ref={incomeProofInputRef} id="income_proof" name="income_proof" accept=".pdf,image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 border border-gray-300 rounded-md p-1 bg-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Distance between stay and College (in Km) *</label>
                            <input type="number" step="0.1" id="distance_km" name="distance_km" required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Student Signature *</label>
                            <input type="file" ref={applicantSignatureInputRef} id="applicant_signature" name="applicant_signature" accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 border border-gray-300 rounded-md p-1 bg-white" onChange={handleSignatureChange} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-gray-500 font-medium order-2 sm:order-1">* Verify details carefully before previewing.</p>
                        <button type="button" id="reviewBtn" onClick={handleReview} className="w-full sm:w-auto px-8 py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg shadow transition-colors tracking-wide uppercase text-sm order-1 sm:order-2">
                            Review
                        </button>
                    </div>
                </form>
            </div>

            {/* Review Preview Modal */}
            <div ref={previewModalRef} id="previewModal" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-amber-200">
                    <div className="bg-amber-800 text-white p-4 font-bold tracking-wide text-center sticky top-0 uppercase text-sm rounded-t-xl">
                        Review Your Registered Information
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b border-gray-100 pb-4">
                            <div className="w-24 h-32 border border-gray-300 bg-gray-50 rounded overflow-hidden flex-shrink-0">
                                <img id="modal-photo-view" src="#" alt="Student Passport" className="w-full h-full object-cover" />
                            </div>
                            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                                <p><strong>Student Name:</strong> <span id="p-name" className="font-semibold text-amber-900"></span></p>
                                <p><strong>Dept No / Roll:</strong> <span id="p-dept-no"></span></p>
                                <p><strong>DOB & Age:</strong> <span id="p-dob"></span></p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                            <div><p><strong>Course:</strong> <span id="p-course"></span></p></div>
                            <div><p><strong>Department:</strong> <span id="p-department"></span></p></div>
                            <div className="sm:col-span-2"><p><strong>Year of Degree:</strong> <span id="p-degree-year"></span></p></div>
                            <div className="border p-2.5 rounded bg-amber-50/30"><p className="font-semibold text-gray-900 mb-1">Permanent Address</p><span id="p-perm-addr"></span></div>
                            <div className="border p-2.5 rounded bg-amber-50/30"><p className="font-semibold text-gray-900 mb-1">Local Address</p><span id="p-local-addr"></span></div>
                            <p><strong>Mobile Number:</strong> <span id="p-mobile"></span></p>
                            <p><strong>Email Address:</strong> <span id="p-email"></span></p>
                            <p><strong>Landline:</strong> <span id="p-land"></span></p>
                            <p><strong>Father's Name:</strong> <span id="p-father-name"></span></p>
                            <p><strong>Father's Occupation:</strong> <span id="p-father-occupation"></span></p>
                            <p><strong>Employment Sector:</strong> <span id="p-employ"></span></p>
                            <p><strong>Annual Income:</strong> ₹<span id="p-income"></span></p>
                            <p><strong>Religion:</strong> <span id="p-religion"></span></p>
                            <p><strong>Community:</strong> <span id="p-community"></span></p>
                            <p><strong>Distance to College:</strong> <span id="p-dist"></span> Km</p>
                            <p><strong>Meal Session:</strong> <span id="p-meal-session" className="font-semibold text-amber-900"></span></p>
                        </div>
                        <div className="border p-2.5 rounded bg-amber-50/30 text-center">
                            <img id="modal-signature-view" src="#" alt="Student Signature" className="w-full h-auto max-h-24 object-contain border border-gray-300 rounded" />
                            <p className="text-sm font-semibold text-gray-900 mt-2">Student Signature</p>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row gap-3 justify-end rounded-b-xl sticky bottom-0">
                        <button type="button" id="closeModalBtn" onClick={handleCloseModal} className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-semibold transition-colors text-sm">
                            Back to Edit
                        </button>
                        <button type="button" id="confirmSubmitBtn" onClick={handleConfirmSubmit} className="w-full sm:w-auto px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded font-bold tracking-wide uppercase text-sm transition-colors">
                            Confirm & Submit Form
                        </button>
                    </div>
                </div>
            </div>

            {/* Submission Success Modal */}
            {submitSuccessModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border border-emerald-200 transform transition-all scale-100">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-300 shadow-inner">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-extrabold text-emerald-950 tracking-tight">
                            Application submitted successfully
                        </h3>
                        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                            Your registration has been submitted and your application PDF document has been generated & downloaded.
                        </p>
                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={handleSuccessOk}
                                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 uppercase text-xs tracking-wider"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Registration Modal */}
            {duplicateModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border border-amber-200 transform transition-all scale-100">
                        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-300 shadow-inner">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-extrabold text-amber-950 tracking-tight">
                            {duplicateMessage}
                        </h3>
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-100/90 text-amber-900 border border-amber-300 text-xs font-semibold rounded-full shadow-sm">
                            <svg className="w-3.5 h-3.5 text-amber-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span>{duplicateTag}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-4 leading-relaxed">
                            An application with this registration number or mobile number already exists in our system. Please check your registration number.
                        </p>
                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={handleCloseDuplicateModal}
                                className="w-full py-3 px-4 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 uppercase text-xs tracking-wider"
                            >
                                Change Registration Number
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

