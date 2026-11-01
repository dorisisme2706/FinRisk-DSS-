from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

MISSING_TOKEN = "__FINRISK_MISSING__"

class FeatureFrameValidator(TransformerMixin, BaseEstimator):
    """Validate explicit predictors and normalize missing representations, without learning statistics."""
    def __init__(self, features, numeric, categorical):
        self.features = features
        self.numeric = numeric
        self.categorical = categorical

    def fit(self, X, y=None):
        self._normalize(X)
        self.feature_names_in_ = np.asarray(self.features, dtype=object)
        self.n_features_in_ = len(self.features)
        return self

    def _normalize(self, X):
        if not isinstance(X, pd.DataFrame):
            raise ValueError("SCHEMA_MISMATCH: pandas DataFrame required.")
        if not X.columns.is_unique:
            raise ValueError("SCHEMA_MISMATCH: duplicate columns.")
        missing = sorted(set(self.features) - set(X.columns))
        extra = sorted(set(X.columns) - set(self.features))
        if missing or extra:
            raise ValueError(f"SCHEMA_MISMATCH: missing={missing}, extra={extra}")
        out = X.loc[:, self.features].copy()
        for col in self.numeric:
            if not pd.api.types.is_numeric_dtype(out[col]):
                raise ValueError("SCHEMA_MISMATCH: expected numeric column " + col)
            values = out[col].to_numpy(dtype=np.float64, na_value=np.nan)
            if np.isinf(values).any():
                raise ValueError("SCHEMA_MISMATCH: infinite value in " + col)
            out[col] = values
        for col in self.categorical:
            series = out[col]
            if not series.dropna().map(lambda x: isinstance(x, str)).all():
                raise ValueError("SCHEMA_MISMATCH: expected text column " + col)
            out[col] = series.astype(object).where(series.notna(), np.nan)
        return out

    def transform(self, X):
        return self._normalize(X)

    def get_feature_names_out(self, input_features=None):
        return np.asarray(self.features, dtype=object)

def make_pipeline(features, numeric, categorical, max_iter=1000):
    numbers = Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True)),
        ("scaler", StandardScaler()),
    ])
    text = Pipeline([
        ("imputer", SimpleImputer(strategy="constant", fill_value=MISSING_TOKEN, keep_empty_features=True)),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=True, dtype=np.float64)),
    ])
    processor = ColumnTransformer([
        ("numeric", numbers, numeric), ("categorical", text, categorical),
    ], remainder="drop", sparse_threshold=1.0)
    return Pipeline([
        ("schema", FeatureFrameValidator(features, numeric, categorical)),
        ("preprocess", processor),
        ("model", LogisticRegression(solver="lbfgs", C=1.0, l1_ratio=0.0,
                                     max_iter=max_iter, tol=1e-4, class_weight=None, random_state=42)),
    ])
