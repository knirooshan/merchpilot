import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { ENDPOINTS } from "../config/api";
import { setUser } from "../store/slices/authSlice";
import { toast } from "react-hot-toast";

const SetupPage = () => {
  const [step, setStep] = useState(1);
  const [passkey, setPasskey] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Step 2 Form Data
  const [formData, setFormData] = useState({
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    orgName: "",
    orgPhone: "",
    orgAddress: "",
    orgCity: "",
    orgZip: "",
    orgCountry: "",
  });

  const validatePasskeyMutation = useMutation({
    mutationFn: async (key) => {
      return apiClient.post(ENDPOINTS.SETUP_VALIDATE, { passkey: key });
    },
    onSuccess: () => {
      setStep(2);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Invalid passkey");
    },
  });

  const completeSetupMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(ENDPOINTS.SETUP_COMPLETE, payload);
      return data;
    },
    onSuccess: (data) => {
      dispatch(setUser(data));
      toast.success("Setup complete!");
      navigate("/", { replace: true });
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Setup failed");
    },
  });

  const handleValidatePasskey = (e) => {
    e.preventDefault();
    validatePasskeyMutation.mutate(passkey);
  };

  const handleCompleteSetup = (e) => {
    e.preventDefault();
    const payload = {
      passkey,
      user: {
        name: formData.adminName,
        email: formData.adminEmail,
        password: formData.adminPassword,
      },
      organization: {
        name: formData.orgName,
        email: formData.adminEmail,
        phone: formData.orgPhone,
        address: {
          street: formData.orgAddress,
          city: formData.orgCity,
          zip: formData.orgZip,
          country: formData.orgCountry,
        },
      },
    };
    completeSetupMutation.mutate(payload);
  };

  const loading = validatePasskeyMutation.isPending || completeSetupMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          className="mx-auto h-12 w-auto"
          src="/merchpilot.png"
          alt="MerchPilot"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          {step === 1 ? "Welcome to MerchPilot" : "Setup Organization"}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          {step === 1
            ? "Please enter your setup passkey to continue."
            : "Create your admin account and organization profile."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-slate-800">
          {step === 1 ? (
            <form className="space-y-6" onSubmit={handleValidatePasskey}>
              <div>
                <label
                  htmlFor="passkey"
                  className="block text-sm font-medium text-slate-300"
                >
                  Setup Passkey
                </label>
                <div className="mt-1">
                  <input
                    id="passkey"
                    name="passkey"
                    type="text"
                    required
                    value={passkey}
                    onChange={(e) => setPasskey(e.target.value.toUpperCase())}
                    className="block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="ENTER-PASS-KEY"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Verifying..." : "Continue"}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleCompleteSetup}>
              {/* Admin Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white border-b border-slate-800 pb-2">
                  Admin Account
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.adminName}
                      onChange={(e) =>
                        setFormData({ ...formData, adminName: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.adminEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, adminEmail: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={formData.adminPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          adminPassword: e.target.value,
                        })
                      }
                      className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Organization Details */}
              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-medium text-white border-b border-slate-800 pb-2">
                  Organization
                </h3>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.orgName}
                    onChange={(e) =>
                      setFormData({ ...formData, orgName: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.orgPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, orgPhone: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.orgAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, orgAddress: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.orgCity}
                      onChange={(e) =>
                        setFormData({ ...formData, orgCity: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.orgCountry}
                      onChange={(e) =>
                        setFormData({ ...formData, orgCountry: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Setting up..." : "Complete Setup"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
